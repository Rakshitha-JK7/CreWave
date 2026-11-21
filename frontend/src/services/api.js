import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach authentication tokens or offline metadata
api.interceptors.request.use(
  (config) => {
    // Phase 7 placeholder: read JWT or bearer token
    const token = typeof localStorage !== 'undefined'
      ? (localStorage.getItem('carewave_auth_token') || localStorage.getItem('carewave_token') || localStorage.getItem('token'))
      : null;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Attach client timestamp and idempotency key if modifying data
    if (['post', 'put', 'patch', 'delete'].includes(config.method?.toLowerCase())) {
      config.headers['X-Client-Timestamp'] = new Date().toISOString();
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Friendly error translations
api.interceptors.response.use(
  (response) => response,
  (error) => {
    let friendlyMessage = 'An unexpected error occurred. Please try again.';

    if (!error.response) {
      // Network failure, backend unreachable or offline
      friendlyMessage = 'Unable to connect to the server. Your data has been saved locally and will sync when connection returns.';
    } else {
      const status = error.response.status;
      if (status === 401) {
        friendlyMessage = 'Session expired. Please re-authenticate.';
        // If an authenticated request is rejected with 401, remove the invalid cached token
        try {
          if (typeof localStorage !== 'undefined' && !error.config?.url?.includes('/auth/login')) {
            localStorage.removeItem('carewave_auth_token');
            localStorage.removeItem('carewave_user');
          }
        } catch (e) {
          // ignore
        }
      } else if (status === 403) {
        friendlyMessage = 'You do not have permission to perform this action.';
      } else if (status === 404) {
        friendlyMessage = 'Requested record could not be found.';
      } else if (status >= 500) {
        friendlyMessage = 'The server encountered an issue. Your consultation is preserved safely on your device.';
      } else if (error.response.data?.message) {
        friendlyMessage = error.response.data.message;
      }
    }

    // Attach user-facing message to error object
    error.userMessage = friendlyMessage;
    return Promise.reject(error);
  }
);

export async function checkServerHealth() {
  try {
    const res = await api.get('/health', { timeout: 3000 });
    return res.status === 200;
  } catch (err) {
    return false;
  }
}

export default api;
