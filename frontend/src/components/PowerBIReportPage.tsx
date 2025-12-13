import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Button,
} from '@mui/material';
import { PowerBIEmbed } from 'powerbi-client-react';
import { models } from 'powerbi-client';
import apiClient from '../services/apiClient';
import { UIConfig } from '../services/featureConfig';

interface PowerBIEmbedConfig {
  reportId: string;
  embedUrl: string;
  embedToken: string;
  tokenExpiration: string;
  workspaceId?: string;
}

interface PowerBIReportPageProps {
  uiConfig: UIConfig;
}

const PowerBIReportPage: React.FC<PowerBIReportPageProps> = ({ uiConfig: _uiConfig }) => {
  const [embedConfig, setEmbedConfig] = useState<PowerBIEmbedConfig | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch embed configuration from backend
  const fetchEmbedConfig = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiClient.get<PowerBIEmbedConfig>('/api/powerbi/embed-config');
      const config = response.data;
      
      setEmbedConfig(config);
      setLoading(false);
    } catch (err: any) {
      console.error('Failed to load Power BI report');
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to load Power BI configuration';
      setError(errorMessage);
      setLoading(false);
    }
  };

  // Load configuration on component mount
  useEffect(() => {
    fetchEmbedConfig();
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 'calc(100vh - 64px)' }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Loading Power BI Report...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert 
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={fetchEmbedConfig}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      </Box>
    );
  }

  if (!embedConfig) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info">
          Power BI configuration not available. Please contact your administrator.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5">
          Power BI Report
        </Typography>
        <Button
          variant="outlined"
          color="secondary"
          size="small"
          onClick={fetchEmbedConfig}
        >
          Refresh
        </Button>
      </Box>

      <Box sx={{ flexGrow: 1, position: 'relative', minHeight: 0 }}>
        <PowerBIEmbed
          embedConfig={{
            type: 'report',
            id: embedConfig.reportId,
            embedUrl: embedConfig.embedUrl,
            accessToken: embedConfig.embedToken,
            tokenType: models.TokenType.Embed,
            settings: {
              panes: {
                filters: {
                  expanded: false,
                  visible: true,
                },
                pageNavigation: {
                  visible: true,
                },
              },
              background: models.BackgroundType.Transparent,
            },
          }}
          eventHandlers={
            new Map([
              [
                'loaded',
                () => {
                  // Report loaded successfully
                },
              ],
              [
                'rendered',
                () => {
                  // Report rendered successfully
                },
              ],
              [
                'error',
                () => {
                  console.error('Failed to load Power BI report');
                  setError('Failed to load Power BI report. The embed token may have expired.');
                },
              ],
            ])
          }
          cssClassName="powerbi-report-container"
          getEmbeddedComponent={() => {
            // Embedded report component initialized
          }}
        />
      </Box>

      <style>
        {`
          .powerbi-report-container {
            height: 100%;
            width: 100%;
            border: none;
          }
          .powerbi-report-container iframe {
            border: none;
          }
        `}
      </style>
    </Box>
  );
};

export default PowerBIReportPage;
