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

      // Acquire token silently
      const response = await msalInstance.acquireTokenSilent({
        ...apiRequest,
        account: accounts[0],
      });
      
      // Add token to request headers
      if (response.accessToken) {
        config.headers.Authorization = `Bearer ${response.accessToken}`;
      }

      return config;
    } catch (error) {
      console.error('Token acquisition failed:', error);
      
      // If silent token acquisition fails, redirect to login
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
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
