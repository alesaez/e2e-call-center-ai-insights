import { Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { useState, useEffect } from 'react';
import LoginPage from './components/LoginPage';
import ProtectedRoute from './components/ProtectedRoute';
import MainLayout from './components/MainLayout';
import DashboardPage from './components/DashboardPage';
import ChatbotPage from './components/ChatbotPage';
import SettingsPage from './components/SettingsPage';
import { createAppTheme, getTenantConfig, TenantConfig, defaultTenantConfig } from './theme/theme';

function App() {
  const [tenantConfig, setTenantConfig] = useState<TenantConfig>(defaultTenantConfig);
  const [theme, setTheme] = useState(createAppTheme(defaultTenantConfig));

  useEffect(() => {
    // Load tenant configuration
    const loadTenantConfig = async () => {
      const config = await getTenantConfig();
      setTenantConfig(config);
      setTheme(createAppTheme(config));
    };
    loadTenantConfig();
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <MainLayout tenantConfig={tenantConfig}>
                <DashboardPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/chatbot"
          element={
            <ProtectedRoute>
              <MainLayout tenantConfig={tenantConfig}>
                <ChatbotPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <MainLayout tenantConfig={tenantConfig}>
                <SettingsPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </ThemeProvider>
  );
}

export default App;
