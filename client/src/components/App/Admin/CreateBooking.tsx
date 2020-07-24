import React, { useContext, useState, useEffect, useCallback, useReducer } from 'react';
import { RouteComponentProps } from '@reach/router';
import format from 'date-fns/format';
import addDays from 'date-fns/addDays';
import { DatePicker } from '@material-ui/pickers';
import FormControl from '@material-ui/core/FormControl';
import InputLabel from '@material-ui/core/InputLabel';
import Select from '@material-ui/core/Select';
import MenuItem from '@material-ui/core/MenuItem';
import TextField from '@material-ui/core/TextField';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Checkbox from '@material-ui/core/Checkbox';
import Snackbar from '@material-ui/core/Snackbar';
import Paper from '@material-ui/core/Paper';
import Alert, { AlertProps } from '@material-ui/lab/Alert';

import { AppContext } from '../../AppProvider';

import AdminLayout from './Layout/Layout';
import Loading from '../../Assets/LoadingSpinner';
import { OurButton } from '../../../styles/MaterialComponents';

import { getOffices, createBooking } from '../../../lib/api';
import { formatError } from '../../../lib/app';
import { OfficeSlot, Office } from '../../../types/api';
import { validateEmail } from '../../../lib/emailValidation';

import CreateBookingStyles from './CreateBooking.styles';

// Reducers
type Alert = {
  message: string;
  severity: AlertProps['severity'];
  visible: boolean;
};

type AlertSet = {
  type: 'set';
  payload: {
    message: Alert['message'];
    severity: Alert['severity'];
  };
};

type AlertHide = {
  type: 'hide';
};

type AlertActions = AlertSet | AlertHide;

const initialAlert: Alert = {
  message: '',
  severity: 'info',
  visible: false,
};

const alertReducer = (state: Alert, action: AlertActions) => {
  switch (action.type) {
    case 'set':
      return {
        ...state,
        ...action.payload,
        visible: true,
      };
    case 'hide':
      return {
        ...state,
        visible: false,
      };
    default:
      return state;
  }
};

// Component
const AdminCreateBooking: React.FC<RouteComponentProps> = () => {
  // Global state
  const { state, dispatch } = useContext(AppContext);
  const { config, user, offices } = state;

  // Local state
  const [loading, setLoading] = useState(false);

  const [office, setOffice] = useState<Office | undefined>();
  const [officeSlot, setOfficeSlot] = useState<OfficeSlot | undefined>();
  const [bookingDate, setBookingDate] = useState(addDays(new Date(), +1));
  const [email, setEmail] = useState('');
  const [parking, setParking] = useState(false);

  // Reducers
  const [alert, alertDispatch] = useReducer(alertReducer, initialAlert);

  // Helpers
  const findOffice = useCallback(
    (name: Office['name']) => offices && offices.find((o) => o.name === name),
    [offices]
  );

  // Effects
  useEffect(() => {
    if (user) {
      // Get all offices
      getOffices()
        .then((data) =>
          // Store in global state
          dispatch({
            type: 'SET_OFFICES',
            payload: data,
          })
        )
        .catch((err) => {
          // Handle errors
          setLoading(false);

          dispatch({
            type: 'SET_ERROR',
            payload: formatError(err),
          });
        });
    }
  }, [dispatch, user]);

  useEffect(() => {
    if (user && offices) {
      // Retrieve first office user can manage bookings for
      setOffice(findOffice(user.permissions.officesCanManageBookingsFor[0]));

      // Wait for global state to be ready
      setLoading(false);
    }
  }, [user, offices, findOffice]);

  useEffect(() => {
    if (office) {
      setOfficeSlot(office.slots.find((s) => s.date === format(bookingDate, 'yyyy-MM-dd')));
    }
  }, [office, bookingDate]);

  // Handlers
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Validation
    if (email === '') {
      return alertDispatch({
        type: 'set',
        payload: {
          severity: 'error',
          message: 'Email address required',
        },
      });
    }

    if (!config || !validateEmail(config.emailRegex, email)) {
      return alertDispatch({
        type: 'set',
        payload: {
          severity: 'error',
          message: 'Valid email address required',
        },
      });
    }

    if (!office || !officeSlot) {
      return alertDispatch({
        type: 'set',
        payload: {
          severity: 'error',
          message: 'Office required',
        },
      });
    }

    if (officeSlot.booked + 1 > office.quota) {
      return alertDispatch({
        type: 'set',
        payload: {
          severity: 'error',
          message: 'No office spaces available',
        },
      });
    }

    if (office.parkingQuota > 0 && parking && officeSlot.bookedParking + 1 > office.parkingQuota) {
      return alertDispatch({
        type: 'set',
        payload: {
          severity: 'error',
          message: 'No parking spaces available',
        },
      });
    }

    // Submit
    const formattedDate = format(bookingDate, 'yyyy-MM-dd');

    createBooking(email, formattedDate, office.name, parking)
      .then((data) => {
        // Update global state
        dispatch({
          type: 'ADD_BOOKING',
          payload: data,
        });

        dispatch({
          type: 'INCREASE_OFFICE_SLOT',
          payload: {
            office: office.name,
            date: formattedDate,
          },
        });

        // Clear form
        setEmail('');

        // Show success alert
        alertDispatch({
          type: 'set',
          payload: {
            severity: 'success',
            message: `Booking created for ${email}!`,
          },
        });
      })
      .catch((err) =>
        // Handle error
        dispatch({
          type: 'SET_ERROR',
          payload: formatError(err),
        })
      );
  };

  // Render
  if (!user) {
    return null;
  }

  return (
    <AdminLayout currentRoute="bookings">
      <CreateBookingStyles>
        {loading ? (
          <Loading />
        ) : (
          <>
            <h3>Bookings</h3>
            <Paper square className="form-container">
              <h4>New Booking</h4>

              <form onSubmit={handleSubmit}>
                <div className="field">
                  <TextField
                    id="outlined-helperText"
                    label="Email address"
                    helperText="Who is the booking for"
                    variant="outlined"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input"
                  />
                </div>

                <div className="field">
                  <FormControl variant="outlined" className="input">
                    <InputLabel id="office-label" shrink>
                      Office
                    </InputLabel>
                    <Select
                      labelId="office-label"
                      id="office"
                      value={office?.name || ''}
                      onChange={(e) => setOffice(offices.find((o) => o.name === e.target.value))}
                      label="Office"
                      required
                    >
                      {user.permissions.officesCanManageBookingsFor.map((o, i) => (
                        <MenuItem value={o} key={i}>
                          {o}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </div>

                {office && (
                  <>
                    <div className="field">
                      <DatePicker
                        autoOk
                        disableToolbar
                        minDate={office.slots[0].date}
                        maxDate={office.slots[office.slots.length - 1].date}
                        inputVariant="outlined"
                        variant="inline"
                        label="Date"
                        format="dd/MM/yyyy"
                        value={bookingDate}
                        onChange={(date) => setBookingDate(date as Date)}
                        className="input"
                      />
                    </div>

                    {officeSlot && (
                      <>
                        <div className="field bump short">
                          <p>
                            <strong>{office.quota - officeSlot.booked}</strong> office spaces
                            available
                          </p>

                          {office.parkingQuota > 0 && (
                            <p>
                              <strong>{office.parkingQuota - officeSlot.bookedParking}</strong>{' '}
                              parking spaces available
                            </p>
                          )}
                        </div>

                        {office.parkingQuota > 0 && (
                          <div className="field bump">
                            <FormControlLabel
                              control={
                                <Checkbox
                                  checked={parking}
                                  onChange={(_, checked) => setParking(checked)}
                                />
                              }
                              label="Include parking"
                              disabled={office.parkingQuota - officeSlot.bookedParking <= 0}
                            />
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}

                <OurButton
                  type="submit"
                  variant="contained"
                  color="primary"
                  disabled={
                    !office ||
                    !officeSlot ||
                    office.quota - officeSlot.booked <= 0 ||
                    (office.parkingQuota > 0 && office.parkingQuota - officeSlot.bookedParking <= 0)
                  }
                >
                  Create booking
                </OurButton>
              </form>
            </Paper>

            <Snackbar open={alert.visible} onClose={() => alertDispatch({ type: 'hide' })}>
              <Alert
                variant="filled"
                severity={alert.severity}
                onClose={() => alertDispatch({ type: 'hide' })}
              >
                {alert.message}
              </Alert>
            </Snackbar>
          </>
        )}
      </CreateBookingStyles>
    </AdminLayout>
  );
};

export default AdminCreateBooking;
