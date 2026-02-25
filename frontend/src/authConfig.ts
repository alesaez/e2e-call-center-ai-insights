// MSAL Configuration for Microsoft Entra ID authentication
import { Configuration, LogLevel } from '@azure/msal-browser';

export const msalConfig: Configuration = {
  auth: {
    clientId: import.meta.env.VITE_ENTRA_CLIENT_ID || '',
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_ENTRA_TENANT_ID || 'common'}`,
    redirectUri: import.meta.env.VITE_REDIRECT_URI || window.location.origin,
    postLogoutRedirectUri: import.meta.env.VITE_POST_LOGOUT_REDIRECT_URI || window.location.origin,
  },
  cache: {
    cacheLocation: 'localStorage', // Persist tokens across tabs / page refreshes
    storeAuthStateInCookie: false, // Set to true for IE11 or Edge
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) {
          return;
        }
        switch (level) {
          case LogLevel.Error:
            console.error(message);
            return;
          case LogLevel.Info:
            console.info(message);
            return;
          case LogLevel.Verbose:
            console.debug(message);
            return;
          case LogLevel.Warning:
            console.warn(message);
            return;
        }
      },
    },
  },
};

// Add scopes for API access
export const loginRequest = {
  scopes: ['User.Read', 'openid', 'profile', 'email'],
};

// Scopes for backend API - use the backend's exposed API scope
// The backend validates tokens with audience = backend's ENTRA_CLIENT_ID
export const apiRequest = {
  scopes: [
    import.meta.env.VITE_API_SCOPE || `api://${import.meta.env.VITE_ENTRA_CLIENT_ID}/.default`
  ],
};
