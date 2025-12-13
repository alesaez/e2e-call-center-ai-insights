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
import { UIConfig, getTabConfig, PowerBIReportChild } from '../services/featureConfig';
import { useParams, useNavigate } from 'react-router-dom';

interface PowerBIEmbedConfig {
  reportId: string;
  embedUrl: string;
  embedToken: string;
  tokenExpiration: string;
  workspaceId?: string;
}

interface PowerBIReportsPageProps {
  uiConfig: UIConfig;
}

const PowerBIReportsPage: React.FC<PowerBIReportsPageProps> = ({ uiConfig }) => {
  const { reportId } = useParams<{ reportId: string }>();
  const navigate = useNavigate();
  const [embedConfig, setEmbedConfig] = useState<PowerBIEmbedConfig | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [currentReport, setCurrentReport] = useState<PowerBIReportChild | null>(null);

  const powerbiReportsTab = getTabConfig(uiConfig, 'powerbi-reports');
  const reports = powerbiReportsTab?.children || [];

  // Find the current report from the configuration
  useEffect(() => {
    if (reportId && reports.length > 0) {
      const report = reports.find(r => r.id === reportId);
      if (report) {
        setCurrentReport(report);
      } else {
        setError(`Report with ID '${reportId}' not found in configuration`);
      }
    } else if (reports.length > 0) {
      // If no reportId in URL, redirect to first report
      navigate(`/powerbi-reports/${reports[0].id}`, { replace: true });
    }
  }, [reportId, reports, navigate]);

  // Fetch embed configuration from backend
  const fetchEmbedConfig = async (report: PowerBIReportChild) => {
    try {
      setLoading(true);
      setError(null);
      
      // Call backend API with specific report and workspace IDs
      const response = await apiClient.get<PowerBIEmbedConfig>(
        `/api/powerbi/embed-config?reportId=${report.reportId}&workspaceId=${report.workspaceId}`
      );
      const config = response.data;
      
      setEmbedConfig(config);
      setLoading(false);
    } catch (err: any) {
      console.error('Failed to load Power BI report:', err);
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to load Power BI configuration';
      setError(errorMessage);
      setLoading(false);
    }
  };

  // Load configuration when current report changes
  useEffect(() => {
    if (currentReport) {
      fetchEmbedConfig(currentReport);
    }
  }, [currentReport]);

  // Auto-refresh token before expiration
  useEffect(() => {
    if (!embedConfig || !currentReport) return;

    const tokenExpiration = new Date(embedConfig.tokenExpiration);
    const now = new Date();
    const timeUntilExpiration = tokenExpiration.getTime() - now.getTime();
    
    // Refresh 5 minutes before expiration
    const refreshTime = Math.max(0, timeUntilExpiration - 5 * 60 * 1000);

    const refreshTimer = setTimeout(() => {
      console.log('Refreshing Power BI embed token...');
      fetchEmbedConfig(currentReport);
    }, refreshTime);

    return () => clearTimeout(refreshTimer);
  }, [embedConfig, currentReport]);

  if (!powerbiReportsTab?.display) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info">
          Power BI Reports feature is not enabled in the current configuration.
        </Alert>
      </Box>
    );
  }

  if (reports.length === 0) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" fontWeight={600} gutterBottom>
          {powerbiReportsTab?.labels.title || 'Power BI Reports'}
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          {powerbiReportsTab?.labels.subtitle || 'Multiple embedded reports'}
        </Typography>
        <Alert severity="info">
          No reports are configured. Please add reports to the configuration.
        </Alert>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        gap: 2
      }}>
        <CircularProgress size={60} />
        <Typography variant="body1" color="text.secondary">
          Loading {currentReport?.labels.name || 'report'}...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" fontWeight={600} gutterBottom>
          {currentReport?.labels.title || 'Power BI Report'}
        </Typography>
        <Alert 
          severity="error" 
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => currentReport && fetchEmbedConfig(currentReport)}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      </Box>
    );
  }

  if (!embedConfig || !currentReport) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">
          No report selected or configuration missing.
        </Alert>
      </Box>
    );
  }

  // Power BI embed configuration
  const powerBIConfig: models.IReportEmbedConfiguration = {
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
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h5" fontWeight={600}>
          {currentReport.labels.title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {currentReport.labels.subtitle}
        </Typography>
      </Box>

      {/* Power BI Embed */}
      <Box sx={{ flexGrow: 1, position: 'relative' }}>
        <PowerBIEmbed
          embedConfig={powerBIConfig}
          eventHandlers={new Map([
            ['loaded', () => console.log('Report loaded')],
            ['rendered', () => console.log('Report rendered')],
            ['error', (event?: any) => {
              console.error('Power BI error:', event?.detail);
              setError('An error occurred while rendering the report');
            }],
          ])}
          cssClassName="powerbi-embed-container"
          getEmbeddedComponent={(embeddedReport) => {
            console.log('Embedded report component:', embeddedReport);
          }}
        />
      </Box>

      <style>
        {`
          .powerbi-embed-container {
            height: 100%;
            width: 100%;
          }
          .powerbi-embed-container iframe {
            border: none;
          }
        `}
      </style>
    </Box>
  );
};

export default PowerBIReportsPage;
