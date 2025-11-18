import axios from 'axios';
import { msalInstance } from './msalInstance';
import { apiRequest } from '../authConfig';

// Create axios instance with base configuration
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add access token
apiClient.interceptors.request.use(
  async (config) => {
    try {
      const accounts = msalInstance.getAllAccounts();
      
      if (accounts.length === 0) {
        console.error('No authenticated account found');
        throw new Error('No authenticated account found');
      }

      console.log('Acquiring token for account:', accounts[0].username);
      console.log('Token request scopes:', apiRequest.scopes);

      // Acquire token silently
      const response = await msalInstance.acquireTokenSilent({
        ...apiRequest,
        account: accounts[0],
      });

      console.log('Token acquired successfully');
      console.log('Token scopes:', response.scopes);
      console.log('ID Token claims:', response.idTokenClaims);
      
      // Decode access token to check audience
      if (response.accessToken) {
        const tokenParts = response.accessToken.split('.');
        if (tokenParts.length === 3) {
          const payload = JSON.parse(atob(tokenParts[1]));
          console.log('Access Token audience:', payload.aud);
          console.log('Access Token scopes:', payload.scp);
        }
      }

      // Add token to request headers
      if (response.accessToken) {
        config.headers.Authorization = `Bearer ${response.accessToken}`;
      }

      return config;
    } catch (error) {
      console.error('Token acquisition failed:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      
      // If silent token acquisition fails, redirect to login
      // Don't try popup as it may be blocked and causes errors
      console.log('Redirecting to login for interactive authentication');
      window.location.href = '/login';
      throw error;
    }
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Handle 401 Unauthorized - token might be expired
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const accounts = msalInstance.getAllAccounts();
        
        if (accounts.length === 0) {
          window.location.href = '/login';
          return Promise.reject(error);
        }

        // Try to get token silently first
        const response = await msalInstance.acquireTokenSilent({
          ...apiRequest,
          account: accounts[0],
        });

        if (response.accessToken) {
          originalRequest.headers.Authorization = `Bearer ${response.accessToken}`;
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        // Redirect to login if token refresh fails
        console.log('Token refresh failed, redirecting to login');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
