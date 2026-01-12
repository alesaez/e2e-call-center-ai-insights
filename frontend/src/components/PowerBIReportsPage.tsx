import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Button,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Snackbar,
} from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import RefreshIcon from '@mui/icons-material/Refresh';
import DownloadIcon from '@mui/icons-material/Download';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
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
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [downloading, setDownloading] = useState<boolean>(false);
  const [snackbarOpen, setSnackbarOpen] = useState<boolean>(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string>('');
  const [embeddedReport, setEmbeddedReport] = useState<any>(null);

  const powerbiReportsTab = getTabConfig(uiConfig, 'powerbi-reports');
  const reports = powerbiReportsTab?.children || [];

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleDownloadPDF = async () => {
    handleMenuClose();
    if (!currentReport) return;

    try {
      setDownloading(true);
      setSnackbarMessage('Starting PDF export...');
      setSnackbarOpen(true);

      // Initiate export
      const exportResponse = await apiClient.post<{ id: string; status: string }>(
        `/api/powerbi/export-pdf?reportId=${currentReport.reportId}&workspaceId=${currentReport.workspaceId}`
      );
      
      const exportId = exportResponse.data.id;
      console.log('Export initiated with ID:', exportId);
      
      setSnackbarMessage('Export in progress... This may take a minute.');
      
      // Poll for completion
      let attempts = 0;
      const maxAttempts = 60; // 60 seconds max (Power BI exports can take time)
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds between polls
        
        try {
          const statusResponse = await apiClient.get<{ status: string; percentComplete?: number }>(
            `/api/powerbi/export-status/${exportId}?reportId=${currentReport.reportId}&workspaceId=${currentReport.workspaceId}`
          );
          
          console.log('Export status:', statusResponse.data);
          
          const exportStatus = statusResponse.data.status;
          const percentComplete = statusResponse.data.percentComplete;
          
          if (percentComplete !== undefined) {
            setSnackbarMessage(`Exporting PDF... ${percentComplete}%`);
          }
          
          if (exportStatus === 'Succeeded') {
            // Download the file
            setSnackbarMessage('Downloading PDF...');
            
            const fileResponse = await apiClient.get(
              `/api/powerbi/export-file/${exportId}?reportId=${currentReport.reportId}&workspaceId=${currentReport.workspaceId}`,
              { responseType: 'blob' }
            );
            
            // Create blob link to download
            const blob = new Blob([fileResponse.data], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${currentReport.labels.name}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            
            setSnackbarMessage('PDF downloaded successfully!');
            setDownloading(false);
            setTimeout(() => setSnackbarOpen(false), 3000);
            return;
          } else if (exportStatus === 'Failed') {
            throw new Error('Export failed on Power BI service');
          }
        } catch (pollError: any) {
          console.error('Error polling export status:', pollError);
          // If it's the last attempt, throw the error
          if (attempts >= maxAttempts - 1) {
            throw pollError;
          }
          // Otherwise, continue polling
        }
        
        attempts++;
      }
      
      throw new Error('Export timeout');
      
    } catch (err: any) {
      console.error('Failed to download PDF:', err);
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to download PDF';
      setSnackbarMessage(`Error: ${errorMessage}`);
      setDownloading(false);
      
      // Keep snackbar open longer for errors
      setTimeout(() => setSnackbarOpen(false), 8000);
    }
  };

  const handleOpenInPowerBI = async () => {
    handleMenuClose();
    if (!currentReport) return;

    try {
      const response = await apiClient.get<{ webUrl: string }>(
        `/api/powerbi/web-url?reportId=${currentReport.reportId}&workspaceId=${currentReport.workspaceId}`
      );
      
      window.open(response.data.webUrl, '_blank');
    } catch (err: any) {
      console.error('Failed to get Power BI URL:', err);
      setSnackbarMessage('Failed to open Power BI. Please try again.');
      setSnackbarOpen(true);
    }
  };

  const handleRefresh = async () => {
    handleMenuClose();
    if (!embeddedReport) return;

    try {
      setSnackbarMessage('Refreshing report data...');
      setSnackbarOpen(true);
      
      await embeddedReport.reload();
      
      setSnackbarMessage('Report refreshed successfully!');
      setTimeout(() => setSnackbarOpen(false), 3000);
    } catch (error) {
      console.error('Failed to refresh report:', error);
      setSnackbarMessage('Failed to refresh report');
      setTimeout(() => setSnackbarOpen(false), 3000);
    }
  };

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
  const fetchEmbedConfig = async (report: PowerBIReportChild, isRefresh = false) => {
    try {
      if (!isRefresh) {
        setLoading(true);
      }
      setError(null);
      
      // Call backend API with specific report and workspace IDs
      const response = await apiClient.get<PowerBIEmbedConfig>(
        `/api/powerbi/embed-config?reportId=${report.reportId}&workspaceId=${report.workspaceId}`
      );
      const config = response.data;
      
      setEmbedConfig(config);
      
      // If we have an embedded report instance and we're refreshing, update its access token
      if (isRefresh && embeddedReport) {
        try {
          await embeddedReport.setAccessToken(config.embedToken);
          console.log('Access token refreshed successfully');
        } catch (err) {
          console.error('Failed to update access token:', err);
        }
      }
      
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
      fetchEmbedConfig(currentReport, true);
    }, refreshTime);

    return () => clearTimeout(refreshTimer);
  }, [embedConfig, currentReport, embeddedReport]);

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
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h5" fontWeight={600}>
            {currentReport.labels.title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {currentReport.labels.subtitle}
          </Typography>
        </Box>
        <IconButton
          onClick={handleMenuOpen}
          disabled={downloading}
          sx={{ ml: 2 }}
        >
          <MoreVertIcon />
        </IconButton>
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'right',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'right',
          }}
        >
          <MenuItem onClick={handleRefresh}>
            <ListItemIcon>
              <RefreshIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Refresh</ListItemText>
          </MenuItem>
          <MenuItem onClick={handleDownloadPDF} disabled={downloading}>
            <ListItemIcon>
              <DownloadIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Download as PDF</ListItemText>
          </MenuItem>
          <MenuItem onClick={handleOpenInPowerBI}>
            <ListItemIcon>
              <OpenInNewIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Open in Power BI</ListItemText>
          </MenuItem>
        </Menu>
      </Box>

      {/* Power BI Embed */}
      <Box sx={{ flexGrow: 1, position: 'relative' }}>
        <PowerBIEmbed
          embedConfig={powerBIConfig}
          eventHandlers={new Map([
            ['loaded', () => {
              console.log('Report loaded');
              setError(null);
            }],
            ['rendered', () => console.log('Report rendered')],
            ['error', async (event?: any) => {
              const errorDetail = event?.detail;
              console.error('Power BI error:', errorDetail);
              
              // Check if error is related to token expiration
              if (errorDetail?.message?.includes('TokenExpired') || 
                  errorDetail?.message?.includes('InvalidAccessToken') ||
                  errorDetail?.errorCode === 'TokenExpired') {
                console.log('Token expired, attempting to refresh...');
                if (currentReport) {
                  await fetchEmbedConfig(currentReport, true);
                }
              } else {
                setError('An error occurred while rendering the report. Please try refreshing.');
              }
            }],
          ])}
          cssClassName="powerbi-embed-container"
          getEmbeddedComponent={(report) => {
            console.log('Embedded report component:', report);
            setEmbeddedReport(report);
          }}
        />
      </Box>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={downloading ? null : 4000}
        onClose={() => !downloading && setSnackbarOpen(false)}
        message={snackbarMessage}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />

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
