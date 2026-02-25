import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { MsalProvider } from '@azure/msal-react';
import App from './App';
import { msalInstance } from './services/msalInstance';

// Await redirect handling BEFORE rendering so that accounts are
// populated when React mounts (prevents flash-to-login on return
// from Entra ID redirect).
await msalInstance.handleRedirectPromise().catch((error) => {
  console.error('Authentication redirect error:', error);
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
