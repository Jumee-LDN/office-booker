import React, { useContext, useState, useEffect } from 'react';
import { RouteComponentProps, navigate } from '@reach/router';
import TextField from '@material-ui/core/TextField';
import Paper from '@material-ui/core/Paper';
import FormControl from '@material-ui/core/FormControl';
import InputLabel from '@material-ui/core/InputLabel';
import Select from '@material-ui/core/Select';
import MenuItem from '@material-ui/core/MenuItem';
import Chip from '@material-ui/core/Chip';
import Autocomplete from '@material-ui/lab/Autocomplete';
import format from 'date-fns/format';
import parse from 'date-fns/parse';

import { AppContext } from '../../AppProvider';

import AdminLayout from './Layout/Layout';
import { OurButton } from '../../../styles/MaterialComponents';
import Loading from '../../Assets/LoadingSpinner';

import { getUser, putUser, getOffices, getBookings } from '../../../lib/api';
import { formatError } from '../../../lib/app';
import { User, Office, Booking } from '../../../types/api';

import UserStyles from './User.styles';
import { DATE_FNS_OPTIONS } from '../../../constants/dates';

// Component
const UserAdmin: React.FC<RouteComponentProps<{ email: string }>> = (props) => {
  // Global state
  const { state, dispatch } = useContext(AppContext);
  const { user } = state;
  const canEdit = user?.permissions.canEditUsers === true;

  // Local state
  const [loading, setLoading] = useState(true);
  const [offices, setOffices] = useState<Office[] | undefined>();
  const [selectedUser, setSelectedUser] = useState<User | undefined>();
  const [bookings, setBookings] = useState<Booking[] | undefined>();

  // Effects
  useEffect(() => {
    if (state.user) {
      getBookings({ user: state.user.email })
        .then((data) => {
          // Split for previous and upcoming
          setBookings(data);
        })
        .catch((err) => {
          // Handle errors
          setLoading(false);

          dispatch({
            type: 'SET_ALERT',
            payload: {
              message: formatError(err),
              color: 'error',
            },
          });
        });
    }
  }, [state.user, dispatch]);

  useEffect(() => {
    if (user && !user.permissions.canViewUsers) {
      // No permissions - Bounce to home page
      navigate('/');
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      // Get selected user
      getUser(props.email || '')
        .then((selectedUser) => setSelectedUser(selectedUser))
        .catch((err) => {
          // Handle errors
          setLoading(false);

          dispatch({
            type: 'SET_ALERT',
            payload: {
              message: formatError(err),
              color: 'error',
            },
          });
        });
    }
  }, [user, props.email, dispatch]);

  useEffect(() => {
    if (user && selectedUser) {
      // Get all offices admin can manage
      getOffices()
        .then((data) =>
          setOffices(
            data.filter((office) =>
              user.permissions.officesCanManageBookingsFor.includes(office.name)
            )
          )
        )
        .catch((err) => {
          // Handle errors
          setLoading(false);

          dispatch({
            type: 'SET_ALERT',
            payload: {
              message: formatError(err),
              color: 'error',
            },
          });
        });
    }
  }, [user, selectedUser, dispatch]);

  useEffect(() => {
    if (offices) {
      // Wait for global state to be ready
      setLoading(false);
    }
  }, [offices]);

  // Handlers
  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Validate
    if (selectedUser === undefined) {
      return;
    }

    if (selectedUser.role.name === 'Office Admin' && selectedUser.role.offices.length === 0) {
      return dispatch({
        type: 'SET_ALERT',
        payload: {
          message: 'Please select at least one office',
          color: 'error',
        },
      });
    }

    // Create/update user
    const role = selectedUser.role.name === 'System Admin' ? undefined : selectedUser.role;

    putUser({
      email: selectedUser.email,
      quota: selectedUser.quota,
      role,
    })
      .then((updatedUser) => {
        // Update local state
        setSelectedUser(updatedUser);

        // Confirmation alert
        dispatch({
          type: 'SET_ALERT',
          payload: {
            message: `${updatedUser.email} updated`,
            color: 'success',
          },
        });
      })
      .catch((err) => {
        // Handle errors
        dispatch({
          type: 'SET_ALERT',
          payload: {
            message: formatError(err),
            color: 'error',
          },
        });
      });
  };

  // Render
  if (!user) {
    return null;
  }

  return (
    <AdminLayout currentRoute="users">
      <UserStyles>
        {loading || !selectedUser || !offices ? (
          <Loading />
        ) : (
          <>
            <h3>Users</h3>

            <Paper square className="form-container">
              <h4>Edit user</h4>
              <h5>{selectedUser.email}</h5>

              <form onSubmit={handleFormSubmit}>
                <div className="field">
                  <FormControl variant="outlined" className="input">
                    <InputLabel id="role-label" shrink>
                      Role
                    </InputLabel>
                    <Select
                      labelId="role-label"
                      id="role"
                      value={selectedUser.role.name}
                      disabled={selectedUser.role.name === 'System Admin' || !canEdit}
                      onChange={(e) => {
                        const { value } = e.target;

                        setSelectedUser((selectedUser) => {
                          if (selectedUser === undefined) {
                            return;
                          }

                          if (value === 'Default') {
                            return { ...selectedUser, role: { name: 'Default' } };
                          }

                          if (value === 'Office Admin') {
                            return {
                              ...selectedUser,
                              role: { name: 'Office Admin', offices: [] },
                            };
                          }

                          return selectedUser;
                        });
                      }}
                      label="Role"
                    >
                      <MenuItem value={'Default'}>Default</MenuItem>
                      <MenuItem value={'Office Admin'}>Office Admin</MenuItem>
                      <MenuItem value={'System Admin'} disabled>
                        System Admin
                      </MenuItem>
                    </Select>
                  </FormControl>
                </div>

                {selectedUser.role.name === 'Office Admin' && (
                  <div className="field">
                    <Autocomplete
                      multiple
                      disabled={!canEdit}
                      options={offices.map((o) => o.name)}
                      value={
                        selectedUser.role.name === 'Office Admin' ? selectedUser.role.offices : []
                      }
                      onChange={(_e, value) =>
                        setSelectedUser((selectedUser) => {
                          if (selectedUser === undefined) {
                            return;
                          }

                          return {
                            ...selectedUser,
                            role: { name: 'Office Admin', offices: value },
                          };
                        })
                      }
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          variant="outlined"
                          label="Offices"
                          fullWidth={false}
                          className="input"
                        />
                      )}
                      renderTags={(selectedOffices, tagProps) =>
                        selectedOffices.map((office, index: number) => (
                          <Chip variant="outlined" label={office} {...tagProps({ index })} />
                        ))
                      }
                    />
                  </div>
                )}

                <div className="field">
                  <TextField
                    type="number"
                    variant="outlined"
                    disabled={!canEdit}
                    label="Weekly quota"
                    value={selectedUser.quota}
                    onChange={(e) => {
                      // Between 0 and 7
                      const quota = Number.parseInt(e.target.value);

                      setSelectedUser(
                        (selectedUser) =>
                          selectedUser && {
                            ...selectedUser,
                            quota: quota >= 0 && quota <= 7 ? quota : quota > 7 ? 7 : 0,
                          }
                      );
                    }}
                    className="input"
                  />
                </div>

                {canEdit && (
                  <div className="buttons">
                    <OurButton
                      type="submit"
                      color="primary"
                      variant="contained"
                      disabled={selectedUser.quota < 0}
                    >
                      Save
                    </OurButton>
                  </div>
                )}
              </form>
              <section className="user-bookings">
                {bookings && bookings.length > 0 && (
                  <>
                    <h4>Bookings</h4>

                      <ul className="bookings-list">
                      {bookings.map((row) => (
                        <li key={row.id} className="booking-list-item">
                          {format(
                            parse(row.date, 'yyyy-MM-dd', new Date(), DATE_FNS_OPTIONS),
                            'do LLLL',
                            DATE_FNS_OPTIONS
                          )}
                          {` `}
                          <span>at {row.office}</span>
                          {` `}
                          <span>{row.parking ? '(+ Parking)' : ''}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </section>
            </Paper>

            <section className="help">
              <h3>About Roles</h3>

              <h4>Default</h4>

              <ul>
                <li>Any user with a valid email address gets this role.</li>
                <li>Can manage their own bookings only.</li>
              </ul>

              <h4>System Admin</h4>

              <ul>
                <li>Must be configured in infrastructure.</li>
                <li>Can view and edit all bookings in the system.</li>
                <li>Can view and edit all users</li>
              </ul>

              <h4>Office Admin</h4>

              <ul>
                <li>Must be assigned by a System Admin.</li>
                <li>Can view and edit bookings for their assigned offices.</li>
                <li>Can view other users (but can't edit).</li>
              </ul>

              <p>A default quota is applied to all users regardless of role.</p>
            </section>
          </>
        )}
      </UserStyles>
    </AdminLayout>
  );
};

export default UserAdmin;
