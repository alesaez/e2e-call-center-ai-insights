import axios from 'axios';
import { msalInstance } from './msalInstance';
import { apiRequest, loginRequest } from '../authConfig';

// Create axios instance with base configuration
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Flag to prevent concurrent interactive login redirects
let isRedirecting = false;

/**
 * Acquire a token silently, with an optional forceRefresh for retry scenarios.
 * Returns the access token string, or null if silent acquisition fails.
 */
async function acquireTokenSilentSafe(forceRefresh = false): Promise<string | null> {
  const accounts = msalInstance.getAllAccounts();
  if (accounts.length === 0) return null;

  try {
    const response = await msalInstance.acquireTokenSilent({
      ...apiRequest,
      account: accounts[0],
      forceRefresh,
    });
    return response.accessToken || null;
  } catch {
    return null;
  }
}

/**
 * Redirect to Entra ID login. Guarded so only one redirect can happen at a time.
 */
function redirectToLogin() {
  if (isRedirecting) return;
  isRedirecting = true;
  // Use MSAL loginRedirect so the redirect promise is handled correctly on return
  msalInstance.loginRedirect(loginRequest).catch((err) => {
    console.error('Login redirect failed:', err);
    isRedirecting = false;
  });
}

// Request interceptor to add access token
apiClient.interceptors.request.use(
  async (config) => {
    const token = await acquireTokenSilentSafe();

    if (!token) {
      // Silent acquisition failed — trigger interactive login instead of a hard redirect.
      // Abort this request; the page will reload after the redirect returns.
      redirectToLogin();
      return Promise.reject(new axios.Cancel('Redirecting to login'));
    }

    config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Cancelled requests (from our own redirect logic) should not be retried
    if (axios.isCancel(error)) return Promise.reject(error);

    const originalRequest = error.config;

    // Handle 401 Unauthorized — token might have expired between request and server validation
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      // Force-refresh the token (bypasses MSAL cache) and retry once
      const freshToken = await acquireTokenSilentSafe(/* forceRefresh */ true);
      if (freshToken) {
        originalRequest.headers.Authorization = `Bearer ${freshToken}`;
        return apiClient(originalRequest);
      }

      // Still failed — go interactive
      redirectToLogin();
      return Promise.reject(error);
    }

    return Promise.reject(error);
  }
);

export default apiClient;
