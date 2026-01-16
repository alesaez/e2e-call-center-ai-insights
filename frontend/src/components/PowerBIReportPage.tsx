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
import { UIConfig, getTabConfig } from '../services/featureConfig';

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

const PowerBIReportPage: React.FC<PowerBIReportPageProps> = ({ uiConfig }) => {
  const [embedConfig, setEmbedConfig] = useState<PowerBIEmbedConfig | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [downloading, setDownloading] = useState<boolean>(false);
  const [snackbarOpen, setSnackbarOpen] = useState<boolean>(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string>('');
  const [embeddedReport, setEmbeddedReport] = useState<any>(null);

  // Get tab configuration
  const powerbiTab = getTabConfig(uiConfig, 'powerbi');

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleDownloadPDF = async () => {
    handleMenuClose();
    if (!embedConfig) return;

    try {
      setDownloading(true);
      setSnackbarMessage('Starting PDF export...');
      setSnackbarOpen(true);

      // Initiate export
      const exportResponse = await apiClient.post<{ id: string; status: string }>(
        `/api/powerbi/export-pdf?reportId=${embedConfig.reportId}&workspaceId=${embedConfig.workspaceId}`
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
            `/api/powerbi/export-status/${exportId}?reportId=${embedConfig.reportId}&workspaceId=${embedConfig.workspaceId}`
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
              `/api/powerbi/export-file/${exportId}?reportId=${embedConfig.reportId}&workspaceId=${embedConfig.workspaceId}`,
              { responseType: 'blob' }
            );
            
            // Create blob link to download
            const blob = new Blob([fileResponse.data], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${powerbiTab?.labels.title || 'report'}.pdf`;
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
    if (!embedConfig) return;

    try {
      const response = await apiClient.get<{ webUrl: string }>(
        `/api/powerbi/web-url?reportId=${embedConfig.reportId}&workspaceId=${embedConfig.workspaceId}`
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

  // Fetch embed configuration from backend
  const fetchEmbedConfig = async (isRefresh = false) => {
    try {
      if (!isRefresh) {
        setLoading(true);
      }
      setError(null);
      
      const response = await apiClient.get<PowerBIEmbedConfig>('/api/powerbi/embed-config');
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

  // Auto-refresh token before expiration
  useEffect(() => {
    if (!embedConfig) return;

    const tokenExpiration = new Date(embedConfig.tokenExpiration);
    const now = new Date();
    const timeUntilExpiration = tokenExpiration.getTime() - now.getTime();
    
    // Refresh 5 minutes before expiration
    const refreshTime = Math.max(0, timeUntilExpiration - 5 * 60 * 1000);

    const refreshTimer = setTimeout(() => {
      console.log('Refreshing Power BI embed token...');
      fetchEmbedConfig(true);
    }, refreshTime);

    return () => clearTimeout(refreshTimer);
  }, [embedConfig, embeddedReport]);

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
            <Button color="inherit" size="small" onClick={() => fetchEmbedConfig()}>
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
        <Box>
          <Typography variant="h5">
            {powerbiTab?.labels.title || 'Power BI Report'}
          </Typography>
          {powerbiTab?.labels.subtitle && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {powerbiTab.labels.subtitle}
            </Typography>
          )}
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
                  console.log('Report loaded successfully');
                  setError(null);
                },
              ],
              [
                'rendered',
                () => {
                  console.log('Report rendered successfully');
                },
              ],
              [
                'error',
                async (event?: any) => {
                  const errorDetail = event?.detail;
                  console.error('Power BI error:', errorDetail);
                  
                  // Check if error is related to token expiration
                  if (errorDetail?.message?.includes('TokenExpired') || 
                      errorDetail?.message?.includes('InvalidAccessToken') ||
                      errorDetail?.errorCode === 'TokenExpired') {
                    console.log('Token expired, attempting to refresh...');
                    await fetchEmbedConfig(true);
                  } else {
                    setError('Failed to load Power BI report. Please try refreshing.');
                  }
                },
              ],
            ])
          }
          cssClassName="powerbi-report-container"
          getEmbeddedComponent={(report) => {
            console.log('Embedded report initialized');
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
