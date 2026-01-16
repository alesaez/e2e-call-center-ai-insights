import { useMsal } from '@azure/msal-react';
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginRequest } from '../authConfig';
import { InteractionStatus } from '@azure/msal-browser';
import { UIConfig, getDefaultRoute } from '../services/featureConfig';
import { Box, Button, Typography, CircularProgress, useTheme } from '@mui/material';
import { getLogoSrc, loadTenantConfig } from '../config/tenantConfig';

interface LoginPageProps {
  uiConfig: UIConfig | null;
}

export default function LoginPage({ uiConfig }: LoginPageProps) {
  const { instance, accounts, inProgress } = useMsal();
  const navigate = useNavigate();
  const hasRedirected = useRef(false);
  const theme = useTheme();
  const tenantConfig = loadTenantConfig();
  const logoSrc = getLogoSrc(tenantConfig);

  useEffect(() => {
    // If already authenticated and not in the middle of interaction, redirect to default route
    if (accounts.length > 0 && inProgress === InteractionStatus.None && !hasRedirected.current && uiConfig) {
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
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          background: `linear-gradient(135deg, ${theme.palette.primary.main}15 0%, ${theme.palette.secondary.main}15 100%)`,
        }}
      >
        <CircularProgress size={60} sx={{ mb: 3 }} />
        <Typography variant="h5" sx={{ fontWeight: 500, mb: 1 }}>
          Authenticating...
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Please wait while we sign you in.
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        height: '100vh',
        overflow: 'hidden',
      }}
    >
      {/* Left side - Branding */}
      <Box
        sx={{
          flex: 1,
          background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          color: 'white',
          padding: 4,
          position: 'relative',
          overflow: 'hidden',
          '@media (max-width: 900px)': {
            display: 'none',
          },
        }}
      >
        {/* Decorative circles */}
        <Box
          sx={{
            position: 'absolute',
            width: '400px',
            height: '400px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.1)',
            top: '-200px',
            left: '-200px',
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            width: '300px',
            height: '300px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.1)',
            bottom: '-150px',
            right: '-150px',
          }}
        />

        {/* Logo or Icon */}
        {logoSrc && (
          <Box
            component="img"
            src={logoSrc}
            alt={tenantConfig.name}
            sx={{
              maxWidth: '200px',
              maxHeight: '100px',
              mb: 4,
              filter: 'brightness(0) invert(1)',
              zIndex: 1,
            }}
          />
        )}

        <Typography
          variant="h3"
          sx={{
            fontWeight: 700,
            mb: 2,
            textAlign: 'center',
            zIndex: 1,
          }}
        >
          {tenantConfig.name}
        </Typography>
        <Typography
          variant="h6"
          sx={{
            fontWeight: 300,
            opacity: 0.9,
            textAlign: 'center',
            maxWidth: '500px',
            zIndex: 1,
          }}
        >
          AI-powered insights to transform your call center operations
        </Typography>
      </Box>

      {/* Right side - Login form */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 4,
          backgroundColor: '#ffffff',
          '@media (max-width: 900px)': {
            background: `linear-gradient(135deg, ${theme.palette.primary.main}10 0%, ${theme.palette.secondary.main}10 100%)`,
          },
        }}
      >
        <Box
          sx={{
            maxWidth: '400px',
            width: '100%',
            textAlign: 'center',
          }}
        >
          {/* Mobile logo */}
          {logoSrc && (
            <Box
              component="img"
              src={logoSrc}
              alt={tenantConfig.name}
              sx={{
                maxWidth: '150px',
                maxHeight: '80px',
                mb: 3,
                display: 'none',
                '@media (max-width: 900px)': {
                  display: 'block',
                  margin: '0 auto 24px',
                },
              }}
            />
          )}

          <Typography
            variant="h4"
            sx={{
              fontWeight: 600,
              mb: 1,
              color: 'text.primary',
            }}
          >
            Welcome
          </Typography>
          <Typography
            variant="body1"
            sx={{
              mb: 4,
              color: 'text.secondary',
            }}
          >
            Sign in to access your dashboard
          </Typography>

          <Button
            variant="contained"
            size="large"
            fullWidth
            onClick={handleLogin}
            sx={{
              py: 1.5,
              fontSize: '16px',
              fontWeight: 500,
              textTransform: 'none',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              '&:hover': {
                boxShadow: '0 6px 16px rgba(0, 0, 0, 0.2)',
              },
            }}
          >
            Sign in with Microsoft
          </Button>

          <Typography
            variant="caption"
            sx={{
              display: 'block',
              mt: 3,
              color: 'text.secondary',
            }}
          >
            By signing in, you agree to our terms of service and privacy policy
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
