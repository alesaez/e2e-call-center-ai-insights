import { createTheme, ThemeOptions } from '@mui/material/styles';
import { tenantConfig as defaultTenantConfig, type TenantConfig } from '../config/tenantConfig';

// Re-export TenantConfig type for backward compatibility
export type { TenantConfig };

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

// Function to fetch tenant configuration
// Loads from environment variables (can be extended to fetch from backend API)
export const getTenantConfig = async (_tenantId?: string): Promise<TenantConfig> => {
  // In future, could fetch from backend based on authenticated user's tenant
  // For now, return config loaded from environment variables
  return defaultTenantConfig;
};

// Re-export defaultTenantConfig for direct access
export { defaultTenantConfig };
