import { useMsal } from '@azure/msal-react';
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginRequest } from '../authConfig';
import { InteractionStatus } from '@azure/msal-browser';
import { UIConfig, getDefaultRoute } from '../services/featureConfig';

interface LoginPageProps {
  uiConfig: UIConfig;
}

export default function LoginPage({ uiConfig }: LoginPageProps) {
  const { instance, accounts, inProgress } = useMsal();
  const navigate = useNavigate();
  const hasRedirected = useRef(false);

  useEffect(() => {
    // If already authenticated and not in the middle of interaction, redirect to default route
    if (accounts.length > 0 && inProgress === InteractionStatus.None && !hasRedirected.current) {
      hasRedirected.current = true;
      navigate(getDefaultRoute(uiConfig), { replace: true });
    }
  }, [accounts, inProgress, navigate, uiConfig]);

  const handleLogin = async () => {
    try {
      await instance.loginRedirect(loginRequest);
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  // Show loading if redirect is in progress
  if (inProgress !== InteractionStatus.None) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column',
        gap: '20px'
      }}>
        <h2>Authenticating...</h2>
        <p>Please wait while we sign you in.</p>
      </div>
    );
  }

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      flexDirection: 'column',
      gap: '20px'
    }}>
      <h1>Call Center AI Insights</h1>
      <button 
        onClick={handleLogin}
        style={{
          padding: '12px 24px',
          fontSize: '16px',
          backgroundColor: '#0078d4',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        Sign in with Microsoft
      </button>
    </div>
  );
}
