import { Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { useState, useEffect } from 'react';
import { useMsal } from '@azure/msal-react';
import { InteractionStatus } from '@azure/msal-browser';
import LoginPage from './components/LoginPage';
import ProtectedRoute from './components/ProtectedRoute';
import MainLayout from './components/MainLayout';
import DashboardPage from './components/DashboardPage';
import ChatbotPage from './components/ChatbotPage';
import AIFoundryPage from './components/AIFoundryPage';
import SettingsPage from './components/SettingsPage';
import PowerBIReportPage from './components/PowerBIReportPage';
import PowerBIReportsPage from './components/PowerBIReportsPage';
import { createAppTheme, getTenantConfig, TenantConfig, defaultTenantConfig } from './theme/theme';
import { applyFavicon, updateDocumentTitle } from './config/tenantConfig';
import { getUIConfig, UIConfig, shouldDisplayTab, getDefaultRoute } from './services/featureConfig';
import { CircularProgress, Box, Button } from '@mui/material';
import apiClient from './services/apiClient';

function App() {
  const { accounts, inProgress, instance } = useMsal();
  const [tenantConfig, setTenantConfig] = useState<TenantConfig>(defaultTenantConfig);
  const [theme, setTheme] = useState(createAppTheme(defaultTenantConfig));
  const [uiConfig, setUIConfig] = useState<UIConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasPermissions, setHasPermissions] = useState<boolean | null>(null);

  const handleSignOut = () => {
    instance.logoutRedirect({
      postLogoutRedirectUri: '/',
    });
  };

  useEffect(() => {
    // Load tenant configuration and UI configuration
    const loadConfigurations = async () => {
      try {
        // Wait for MSAL initialization to complete
        if (inProgress !== InteractionStatus.None) {
          return; // Still initializing, wait
        }

        // Load tenant config (public endpoint - doesn't require auth)
        const config = await getTenantConfig();
        setTenantConfig(config);
        setTheme(createAppTheme(config));
        
        // Apply branding
        applyFavicon(config.faviconUrl);
        updateDocumentTitle(config.name);

        // Only load UI config if user is authenticated
        if (accounts.length > 0) {
          try {
            // Try to load UI config - this endpoint requires at least Reader role
            // If user doesn't have any role, this will return 403
            const ui = await getUIConfig();
            setUIConfig(ui);
            setHasPermissions(true); // If config loaded successfully, user has permissions
          } catch (error: any) {
            console.error('Failed to load UI config:', error);
            
            // Check if it's a 403 Forbidden error (no permissions/roles)
            if (error.response?.status === 403) {
              console.warn('User does not have required permissions (403 Forbidden)');
              setHasPermissions(false);
            } else if (error.response?.status === 401) {
              // Unauthorized - token issue, let MSAL handle it
              console.error('Authentication error (401 Unauthorized)');
              setHasPermissions(false);
            } else {
              // Other errors - could be network, server error, etc.
              // Still deny access to be safe
              console.error('Error loading configuration:', error);
              setHasPermissions(false);
            }
          }
        }
      } catch (error) {
        console.error('Error loading configurations:', error);
      } finally {
        // Always stop loading after configuration attempt
        setLoading(false);
      }
    };
    
    loadConfigurations();
  }, [accounts.length, inProgress]);

  // Show Access Denied page if user has no permissions
  if (accounts.length > 0 && hasPermissions === false) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            gap: 3,
            px: 3,
            textAlign: 'center',
          }}
        >
          <Box
            sx={{
              fontSize: '64px',
              color: 'error.main',
            }}
          >
            🚫
          </Box>
          <Box
            sx={{
              fontSize: '32px',
              fontWeight: 600,
              color: 'text.primary',
            }}
          >
            Access Denied
          </Box>
          <Box
            sx={{
              fontSize: '16px',
              color: 'text.secondary',
              maxWidth: '600px',
            }}
          >
            You do not have the required permissions to access this application.
            <br />
            Please contact your administrator to request access.
          </Box>
          <Box
            sx={{
              mt: 2,
              p: 2,
              bgcolor: 'background.paper',
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Box sx={{ fontWeight: 500, mb: 1 }}>What you can do:</Box>
            <Box sx={{ fontSize: '14px', color: 'text.secondary', textAlign: 'left' }}>
              • Contact your IT administrator or application owner
              <br />
              • Request assignment to an appropriate application role
              <br />
              • Verify you're using the correct account
            </Box>
          </Box>
          <Button
            variant="contained"
            color="primary"
            onClick={handleSignOut}
            sx={{ mt: 2 }}
          >
            Sign Out
          </Button>
        </Box>
      </ThemeProvider>
    );
  }

  // Show loading spinner while:
  // 1. MSAL is initializing, OR
  // 2. Initial loading is in progress, OR
  // 3. User is authenticated but permissions haven't been checked yet, OR
  // 4. User has permissions but uiConfig hasn't loaded yet
  const shouldShowLoading = 
    inProgress !== InteractionStatus.None || 
    loading || 
    (accounts.length > 0 && hasPermissions === null) ||
    (accounts.length > 0 && hasPermissions === true && !uiConfig);
  
  if (shouldShowLoading) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            gap: 2,
          }}
        >
          <CircularProgress />
          <Box sx={{ color: 'text.secondary' }}>
            {inProgress !== InteractionStatus.None 
              ? 'Authenticating...' 
              : (accounts.length > 0 && hasPermissions === null)
              ? 'Checking permissions...'
              : (accounts.length > 0 && hasPermissions === true && !uiConfig)
              ? 'Loading configuration...'
              : 'Loading...'}
          </Box>
        </Box>
      </ThemeProvider>
    );
  }

  // If not authenticated and not loading, let routes handle redirect to login
  // uiConfig will be null if user is not authenticated, which is expected

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Routes>
        <Route path="/login" element={<LoginPage uiConfig={uiConfig} />} />
        
        {/* Protected routes - only render if uiConfig is loaded (user is authenticated) */}
        {uiConfig && (
          <>
            {/* Dashboard Route */}
            {shouldDisplayTab(uiConfig, 'dashboard') && (
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <MainLayout tenantConfig={tenantConfig} uiConfig={uiConfig}>
                      <DashboardPage uiConfig={uiConfig} />
                    </MainLayout>
                  </ProtectedRoute>
                }
              />
            )}
        
        {/* Copilot Studio Chatbot Route */}
        {shouldDisplayTab(uiConfig, 'copilot-studio') && (
          <Route
            path="/chatbot"
            element={
              <ProtectedRoute>
                <MainLayout tenantConfig={tenantConfig} uiConfig={uiConfig}>
                  <ChatbotPage uiConfig={uiConfig} />
                </MainLayout>
              </ProtectedRoute>
            }
          />
        )}
        
        {/* AI Foundry Route */}
        {shouldDisplayTab(uiConfig, 'ai-foundry') && (
          <Route
            path="/ai-foundry"
            element={
              <ProtectedRoute>
                <MainLayout tenantConfig={tenantConfig} uiConfig={uiConfig}>
                  <AIFoundryPage uiConfig={uiConfig} />
                </MainLayout>
              </ProtectedRoute>
            }
          />
        )}
        
        {/* Power BI Route */}
        {shouldDisplayTab(uiConfig, 'powerbi') && (
          <Route
            path="/powerbi"
            element={
              <ProtectedRoute>
                <MainLayout tenantConfig={tenantConfig} uiConfig={uiConfig}>
                  <PowerBIReportPage uiConfig={uiConfig} />
                </MainLayout>
              </ProtectedRoute>
            }
          />
        )}
        
        {/* Power BI Reports Route - Multiple Reports */}
        {shouldDisplayTab(uiConfig, 'powerbi-reports') && (
          <Route
            path="/powerbi-reports/:reportId"
            element={
              <ProtectedRoute>
                <MainLayout tenantConfig={tenantConfig} uiConfig={uiConfig}>
                  <PowerBIReportsPage uiConfig={uiConfig} />
                </MainLayout>
              </ProtectedRoute>
            }
          />
        )}
        
        {/* Settings Route - Always enabled */}
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <MainLayout tenantConfig={tenantConfig} uiConfig={uiConfig}>
                <SettingsPage uiConfig={uiConfig} />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        
        {/* Default Route */}
        <Route path="/" element={<Navigate to={getDefaultRoute(uiConfig)} replace />} />
          </>
        )}
        
        {/* Fallback route when not authenticated */}
        {!uiConfig && (
          <Route path="*" element={<Navigate to="/login" replace />} />
        )}
      </Routes>
    </ThemeProvider>
  );
}

export default App;
