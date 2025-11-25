import { ReactNode, useRef } from 'react';
import { useMsal } from '@azure/msal-react';
import { Navigate } from 'react-router-dom';
import { InteractionStatus } from '@azure/msal-browser';

interface ProtectedRouteProps {
  children: ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { accounts, inProgress } = useMsal();
  const hasRedirected = useRef(false);



  // Show loading while authentication is in progress
  if (inProgress === InteractionStatus.Startup || 
      inProgress === InteractionStatus.HandleRedirect ||
      inProgress === InteractionStatus.Login) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        <div>Loading authentication...</div>
      </div>
    );
  }

  // Only redirect to login if no accounts AND no interaction in progress
  if (accounts.length === 0 && inProgress === InteractionStatus.None && !hasRedirected.current) {
    hasRedirected.current = true;
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
