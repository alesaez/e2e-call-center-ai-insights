import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { MsalProvider } from '@azure/msal-react';
import { PublicClientApplication, EventType } from '@azure/msal-browser';
import App from './App';
import { msalConfig } from './authConfig';

// Create MSAL instance
const msalInstance = new PublicClientApplication(msalConfig);

// Initialize MSAL and handle redirects
await msalInstance.initialize();

// Handle redirect promise to catch redirect response
msalInstance.handleRedirectPromise().then((response) => {
  // Login redirect handled silently
}).catch((error) => {
  console.error('Authentication error:', error);
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MsalProvider instance={msalInstance}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </MsalProvider>
  </React.StrictMode>
);
