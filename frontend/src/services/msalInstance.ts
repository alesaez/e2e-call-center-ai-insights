import { PublicClientApplication } from '@azure/msal-browser';
import { msalConfig } from '../authConfig';

// Export MSAL instance for use in API client
export const msalInstance = new PublicClientApplication(msalConfig);

// Initialize MSAL
await msalInstance.initialize();
