import React, { useContext, useState, useEffect } from 'react';
import { RouteComponentProps, navigate } from '@reach/router';
import TableContainer from '@material-ui/core/TableContainer';
import Table from '@material-ui/core/Table';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import TableCell from '@material-ui/core/TableCell';
import TableBody from '@material-ui/core/TableBody';
import Paper from '@material-ui/core/Paper';
import InputLabel from '@material-ui/core/InputLabel';
import Button from '@material-ui/core/Button';
import Select from '@material-ui/core/Select';
import MenuItem from '@material-ui/core/MenuItem';
import TextField from '@material-ui/core/TextField';
import FormControl from '@material-ui/core/FormControl';
import InputAdornment from '@material-ui/core/InputAdornment';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';
import CreateIcon from '@material-ui/icons/Create';
import SearchIcon from '@material-ui/icons/Search';
import AddCircleIcon from '@material-ui/icons/AddCircle';
import IconButton from '@material-ui/core/IconButton';

import { AppContext } from '../../AppProvider';
import Loading from '../../Assets/LoadingSpinner';

import AdminLayout from './Layout/Layout';
import { OurButton } from '../../../styles/MaterialComponents';

import { validateEmail } from '../../../lib/emailValidation';
import { User, UserQuery } from '../../../types/api';
import { queryUsers } from '../../../lib/api';
import { formatError } from '../../../lib/app';

import UsersStyles from './Users.styles';
import { DialogTitle } from '@material-ui/core';

// Types
type UserFilter = {
  user: 'active' | 'custom' | 'System Admin' | 'Office Admin';
  email?: string;
};

// Helpers
const userFilterToQuery = (filter: UserFilter): UserQuery => {
  const query: UserQuery = { emailPrefix: filter.email };

  if (filter.user === 'Office Admin') {
    query.role = 'Office Admin';
  } else if (filter.user === 'System Admin') {
    query.role = 'System Admin';
  } else if (filter.user === 'custom') {
    query.quota = 'custom';
  }

  return query;
};

// Component
const Users: React.FC<RouteComponentProps> = () => {
  // Global state
  const { state, dispatch } = useContext(AppContext);
  const { user } = state;

  // Local state
  const [loading, setLoading] = useState(true);
  const [queryResult, setQueryResult] = useState<User[] | undefined>(undefined);
  const [paginationToken, setPaginationToken] = useState<string | undefined>();
  const [selectedFilter, setSelectedFilter] = useState<UserFilter>({
    user: 'active',
  });
  const [email, setEmail] = useState<string>('');

  const [showAddUser, setShowAddUser] = useState(false);
  const [addUserEmail, setAddUserEmail] = useState('');
  const [addUserError, setAddUserError] = useState(false);

  // Effects
  useEffect(() => {
    // Retrieve results
    queryUsers(userFilterToQuery(selectedFilter))
      .then((result) => {
        setQueryResult(result.users);
        setPaginationToken(result.paginationToken);
      })
      .catch((err) => {
        // Handle errors
        setLoading(false);

        dispatch({
          type: 'SET_ERROR',
          payload: formatError(err),
        });
      });
  }, [selectedFilter, dispatch]);

  useEffect(() => {
    if (queryResult) {
      // Wait for local state to be ready
      setLoading(false);
    }
  }, [queryResult]);

  useEffect(() => {
    // Only allow the following
    // - Different to value in local state
    // AND
    // - Not blank OR blank when there was a previous value
    const sanitisedEmail = email.trim().toLowerCase();

    if (
      sanitisedEmail !== selectedFilter.email &&
      (sanitisedEmail !== '' || (selectedFilter.email && sanitisedEmail === ''))
    ) {
      // Search after typing has stopped
      const searchEmailTimer = setTimeout(() => {
        setSelectedFilter((filter) => ({
          ...filter,
          email: sanitisedEmail,
        }));
      }, 1000);

      // Cleanup
      return () => clearTimeout(searchEmailTimer);
    }

    return;
  }, [selectedFilter.email, email]);

  // Handlers
  const handleChangeUser = (e: React.ChangeEvent<{ value: unknown }>) => {
    const user = e.target.value as string;

    if (
      user === 'active' ||
      user === 'System Admin' ||
      user === 'Office Admin' ||
      user === 'custom'
    ) {
      setSelectedFilter((filter) => ({ ...filter, user }));
    }
  };

  const handleLoadMore = () => {
    if (paginationToken && selectedFilter.user === 'active') {
      // Clear the current token
      setPaginationToken(undefined);

      // Retrieve data after pagination token
      queryUsers({}, paginationToken)
        .then((result) => {
          // Merge new results with existing
          setQueryResult((previousUsers) => [...(previousUsers ?? []), ...result.users]);

          setPaginationToken(result.paginationToken);
        })
        .catch((error) =>
          dispatch({
            type: 'SET_ERROR',
            payload: formatError(error),
          })
        );
    }
  };

  const handleAdduser = () => {
    if (validateEmail(state.config?.emailRegex, addUserEmail)) {
      setAddUserError(false);

      navigate(`/admin/users/${addUserEmail}`);
    } else {
      setAddUserError(true);
    }
  };

  // Render
  if (!user) {
    return null;
  }

  return (
    <AdminLayout currentRoute="users">
      <UsersStyles>
        {loading ? (
          <Loading />
        ) : (
          <>
            <h3>Users</h3>

            <OurButton
              startIcon={<AddCircleIcon />}
              type="submit"
              color="secondary"
              onClick={() => setShowAddUser(true)}
              variant="contained"
              size="small"
            >
              New user
            </OurButton>

            <Paper square className="table-container">
              <section className="filters">
                <div className="filter-role">
                  <FormControl>
                    <InputLabel>User</InputLabel>
                    <Select value={selectedFilter.user} onChange={handleChangeUser}>
                      <MenuItem value="active">All active users</MenuItem>
                      <MenuItem value="System Admin">System Admins</MenuItem>
                      <MenuItem value="Office Admin">Office Admins</MenuItem>
                      <MenuItem value="custom">With custom quota</MenuItem>
                    </Select>
                  </FormControl>
                </div>

                <div className="search-user">
                  <TextField
                    placeholder="Start of email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon />
                        </InputAdornment>
                      ),
                    }}
                  />
                </div>
              </section>

              {selectedFilter.user === 'active' && (
                <p className="note">
                  Please note, a user is only considered "active" after logging into the app the
                  first time.
                </p>
              )}

              <TableContainer className="table">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell className="table-header">User Email</TableCell>
                      <TableCell className="table-header">Quota</TableCell>
                      <TableCell className="table-header">Role</TableCell>
                      <TableCell className="table-header" />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {queryResult && queryResult.length > 0 ? (
                      queryResult.map((user) => (
                        <TableRow key={user.email}>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>{user.quota}</TableCell>
                          <TableCell>{user.role.name}</TableCell>
                          <TableCell align="right">
                            <IconButton onClick={() => navigate(`/admin/users/${user.email}`)}>
                              <CreateIcon />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell>No users found</TableCell>
                        <TableCell />
                        <TableCell />
                        <TableCell />
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              {paginationToken && (
                <section className="load-more-container">
                  <OurButton onClick={handleLoadMore} color="primary" variant="contained">
                    Load More
                  </OurButton>
                </section>
              )}

              {selectedFilter.user === 'active' &&
                selectedFilter.email !== undefined &&
                validateEmail(state.config?.emailRegex, selectedFilter.email) &&
                queryResult?.length === 0 && (
                  <section className="unregistered-user">
                    <div className="link">
                      <p>
                        User <span>{selectedFilter.email}</span> not yet registered
                      </p>

                      <OurButton
                        startIcon={<AddCircleIcon />}
                        type="submit"
                        variant="contained"
                        color="primary"
                        onClick={() => navigate(`/admin/users/${selectedFilter.email}`)}
                        size="small"
                      >
                        Add user
                      </OurButton>
                    </div>

                    <p>
                      Please note the user will not be considered "active" until they login for the
                      first time.
                    </p>
                  </section>
                )}
            </Paper>

            <Dialog open={showAddUser} onClose={() => setShowAddUser(false)}>
              <DialogTitle>Enter the email address for the user you wish to create.</DialogTitle>
              <DialogContent>
                <DialogContentText>
                  Please note the user will not be considered "active" until they login for the
                  first time.
                </DialogContentText>

                <TextField
                  autoFocus
                  label="Email Address"
                  type="email"
                  value={addUserEmail}
                  onChange={(e) => setAddUserEmail(e.target.value)}
                  error={addUserError}
                  helperText={addUserError && `Invalid email address`}
                  fullWidth
                />
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setShowAddUser(false)} color="primary" autoFocus>
                  Cancel
                </Button>
                <Button
                  startIcon={<AddCircleIcon />}
                  variant="contained"
                  onClick={() => handleAdduser()}
                  color="secondary"
                >
                  New user
                </Button>
              </DialogActions>
            </Dialog>
          </>
        )}
      </UsersStyles>
    </AdminLayout>
  );
};

export default Users;
