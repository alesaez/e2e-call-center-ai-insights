import { Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { useState, useEffect } from 'react';
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
import { CircularProgress, Box } from '@mui/material';

function App() {
  const [tenantConfig, setTenantConfig] = useState<TenantConfig>(defaultTenantConfig);
  const [theme, setTheme] = useState(createAppTheme(defaultTenantConfig));
  const [uiConfig, setUIConfig] = useState<UIConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load tenant configuration and UI configuration
    const loadConfigurations = async () => {
      try {
        // Load tenant config
        const config = await getTenantConfig();
        setTenantConfig(config);
        setTheme(createAppTheme(config));
        
        // Apply branding
        applyFavicon(config.faviconUrl);
        updateDocumentTitle(config.name);

        // Load UI config
        const ui = await getUIConfig();
        setUIConfig(ui);
      } catch (error) {
        console.error('Error loading configurations:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadConfigurations();
  }, []);

  // Show loading spinner while configurations are being loaded
  if (loading || !uiConfig) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
          }}
        >
          <CircularProgress />
        </Box>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Routes>
        <Route path="/login" element={<LoginPage uiConfig={uiConfig} />} />
        
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
      </Routes>
    </ThemeProvider>
  );
}

export default App;
