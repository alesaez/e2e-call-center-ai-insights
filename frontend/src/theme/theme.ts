import { createTheme, ThemeOptions } from '@mui/material/styles';

// Tenant configuration interface for white labeling
export interface TenantConfig {
  tenantId: string;
  name: string;
  logo?: string;
  primaryColor: string;
  secondaryColor: string;
  logoUrl?: string;
}

// Default tenant configuration
export const defaultTenantConfig: TenantConfig = {
  tenantId: 'default',
  name: 'Call Center AI Insights',
  primaryColor: '#0078d4', // Microsoft blue
  secondaryColor: '#2b88d8',
};

// Create Material-UI theme based on tenant configuration
export const createAppTheme = (tenantConfig: TenantConfig = defaultTenantConfig) => {
  const themeOptions: ThemeOptions = {
    palette: {
      mode: 'light',
      primary: {
        main: tenantConfig.primaryColor,
      },
      secondary: {
        main: tenantConfig.secondaryColor,
      },
      background: {
        default: '#f5f5f5',
        paper: '#ffffff',
      },
    },
    typography: {
      fontFamily: '"Segoe UI", "Roboto", "Helvetica", "Arial", sans-serif',
      h4: {
        fontWeight: 600,
      },
      h5: {
        fontWeight: 600,
      },
      h6: {
        fontWeight: 600,
      },
    },
    shape: {
      borderRadius: 8,
    },
    components: {
      MuiCard: {
        styleOverrides: {
          root: {
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            transition: 'box-shadow 0.3s ease-in-out',
            '&:hover': {
              boxShadow: '0 4px 8px rgba(0,0,0,0.15)',
            },
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: '#ffffff',
            borderRight: '1px solid rgba(0, 0, 0, 0.12)',
          },
        },
      },
    },
  };

  return createTheme(themeOptions);
};

// Mock function to fetch tenant configuration
// In production, this would fetch from your backend API
export const getTenantConfig = async (tenantId?: string): Promise<TenantConfig> => {
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Return default config for now
  // In production, fetch from backend based on authenticated user's tenant
  return defaultTenantConfig;
};
