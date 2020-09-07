import { getAuthorization } from './auth';
import {
  User,
  OfficeWithSlots,
  Booking,
  UserQuery,
  DefaultRole,
  OfficeAdminRole,
  UserQueryResponse,
  Office,
} from '../types/api';

// Constants
const BASE_URL = new URL('/api/', window.location.origin);

// Helpers
const buildHttpError = async (response: Response): Promise<Error> => {
  const responseText = await response.text();
  const error = new Error(responseText);

  error.name = `${response.status} ${response.statusText}`;

  return error;
};

const buildHeaders = async () => {
  const defaultHeaders = {
    'Content-Type': 'application/json',
  };
  // Get JWT Token
  const Authorization = await getAuthorization();
  if (Authorization !== undefined) {
    return {
      ...defaultHeaders,
      Authorization,
    };
  }
  return defaultHeaders;
};

// Queries
export const queryUsers = async (
  query: UserQuery,
  paginationToken?: string
): Promise<UserQueryResponse> => {
  const url = new URL(`users`, BASE_URL);
  if (query.role !== undefined) {
    url.searchParams.set('role', query.role);
  }
  if (query.quota !== undefined) {
    url.searchParams.set('quota', query.quota);
  }
  if (query.emailPrefix !== undefined) {
    url.searchParams.set('emailPrefix', query.emailPrefix);
  }
  if (paginationToken !== undefined) {
    url.searchParams.set('paginationToken', paginationToken);
  }

  const headers = await buildHeaders();

  const response = await fetch(url.href, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    throw await buildHttpError(response);
  }

  return await response.json();
};

export const getUser = async (email: string): Promise<User> => {
  const url = new URL(`users/${email}`, BASE_URL);

  const headers = await buildHeaders();

  const response = await fetch(url.href, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    throw await buildHttpError(response);
  }

  return await response.json();
};

export const registerUser = async (user: { email: string }): Promise<void> => {
  const url = new URL(`users`, BASE_URL);

  const response = await fetch(url.href, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action: 'Register', email: user.email }),
  });

  if (!response.ok) {
    throw await buildHttpError(response);
  }
};

export const putUser = async (user: {
  email: string;
  quota?: number | null;
  role?: DefaultRole | OfficeAdminRole;
}): Promise<User> => {
  const url = new URL(`users/${user.email}`, BASE_URL);

  const headers = await buildHeaders();

  const response = await fetch(url.href, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ quota: user.quota, role: user.role }),
  });

  if (!response.ok) {
    throw await buildHttpError(response);
  }

  return await response.json();
};

let userCache: [string, Promise<User>] | undefined = undefined;

/**
 * Doesn't include user bookings as won't get refreshed due to caching
 */
export const getUserCached = async (email: string): Promise<User> => {
  if (userCache !== undefined && userCache[0] === email) {
    try {
      return await userCache[1];
    } catch (err) {
      console.warn('Ignoring previous fetch error, retrying');
    }
  }
  const userPromise = getUser(email);
  userCache = [email, userPromise];
  try {
    return await userPromise;
  } catch (err) {
    userCache = undefined;
    throw err;
  }
};

export const getOffice = async (officeId: string): Promise<OfficeWithSlots> => {
  const url = new URL(`offices/${officeId}`, BASE_URL);

  const headers = await buildHeaders();

  const response = await fetch(url.href, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    throw await buildHttpError(response);
  }

  return await response.json();
};

export const getOffices = async (): Promise<Office[]> => {
  const url = new URL('offices', BASE_URL);

  const headers = await buildHeaders();

  const response = await fetch(url.href, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    throw await buildHttpError(response);
  }

  return await response.json();
};

export const getBookings = async ({
  user,
  office,
  date,
}: { user?: string; office?: { id: string }; date?: string } = {}): Promise<Booking[]> => {
  const params = new URLSearchParams();
  if (user !== undefined) {
    params.set('user', user);
  }
  if (office !== undefined) {
    params.set('office', office.id);
  }
  if (date !== undefined) {
    params.set('date', date);
  }
  const url = new URL(`bookings?${params.toString()}`, BASE_URL);

  const headers = await buildHeaders();

  const response = await fetch(url.href, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    throw await buildHttpError(response);
  }

  return await response.json();
};

export const createBooking = async (
  user: User['email'],
  date: string,
  office: Pick<Office, 'id'>,
  parking?: boolean
): Promise<Booking> => {
  const url = new URL('bookings', BASE_URL);

  const headers = await buildHeaders();
  const body = {
    user,
    date,
    office,
    parking,
  };

  const response = await fetch(url.href, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw await buildHttpError(response);
  }

  return await response.json();
};

export const cancelBooking = async (id: Booking['id'], user: User['email']): Promise<void> => {
  const url = new URL(`bookings/${id}?user=${user}`, BASE_URL);

  const headers = await buildHeaders();

  const response = await fetch(url.href, {
    method: 'DELETE',
    headers,
  });

  if (!response.ok) {
    throw await buildHttpError(response);
  }
};
