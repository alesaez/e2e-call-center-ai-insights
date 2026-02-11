import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Tabs,
  Tab,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  Alert,
  Chip,
  Stack,
  Card,
  CardContent,
  CardActions,
  Grid,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  CircularProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  CheckCircle as CheckCircleIcon,
  Security as SecurityIcon,
} from '@mui/icons-material';
import apiClient from '../services/apiClient';
import { UIConfig } from '../services/featureConfig';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

interface QueryTemplate {
  id: string;
  name: string;
  description?: string;
  template: string;
  category: string;
  is_active: boolean;
}

interface UserPermissionsData {
  user_id: string;
  user_email: string;
  roles: string[];
  permissions: string[];
  is_administrator: boolean;
}

interface SettingsPageProps {
  uiConfig: UIConfig;
}

export default function SettingsPage({ uiConfig: _uiConfig }: SettingsPageProps) {
  const [tabValue, setTabValue] = useState(0);
  const [templates, setTemplates] = useState<QueryTemplate[]>([]);
  const [userPermissions, setUserPermissions] = useState<UserPermissionsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<QueryTemplate | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    template: '',
    category: 'General',
  });

  // Load templates
  useEffect(() => {
    if (tabValue === 1) {
      loadTemplates();
    } else if (tabValue === 3) {
      loadUserPermissions();
    }
  }, [tabValue]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get('/api/query-templates');
      setTemplates(response.data.templates);
    } catch (err: any) {
      setError('Failed to load query templates');
      console.error('Error loading templates:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadUserPermissions = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get('/api/user/permissions');
      setUserPermissions(response.data);
    } catch (err: any) {
      setError('Failed to load user permissions');
      console.error('Error loading permissions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleOpenDialog = (template?: QueryTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setFormData({
        name: template.name,
        description: template.description || '',
        template: template.template,
        category: template.category,
      });
    } else {
      setEditingTemplate(null);
      setFormData({
        name: '',
        description: '',
        template: '',
        category: 'General',
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingTemplate(null);
  };

  const handleSaveTemplate = async () => {
    try {
      setError(null);
      
      if (editingTemplate) {
        // Update existing
        await apiClient.put(`/api/query-templates/${editingTemplate.id}`, formData);
        setSuccess('Template updated successfully');
      } else {
        // Create new
        await apiClient.post('/api/query-templates', formData);
        setSuccess('Template created successfully');
      }
      
      handleCloseDialog();
      loadTemplates();
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save template');
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) {
      return;
    }
    
    try {
      setError(null);
      await apiClient.delete(`/api/query-templates/${templateId}`);
      setSuccess('Template deleted successfully');
      loadTemplates();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to delete template');
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Settings
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Paper>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab label="User Preferences" />
          <Tab label="Query Templates" />
          <Tab label="Notifications" />
          <Tab label="My Permissions" />
        </Tabs>

        {/* User Preferences Tab */}
        <TabPanel value={tabValue} index={0}>
          <Typography variant="body1" color="text.secondary">
            User preferences will be implemented here.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Features to be added:
          </Typography>
          <ul style={{ marginTop: '8px' }}>
            <li>Theme customization (light/dark mode)</li>
            <li>Default dashboard view</li>
            <li>Language selection</li>
            <li>Time zone settings</li>
          </ul>
        </TabPanel>

        {/* Query Templates Tab */}
        <TabPanel value={tabValue} index={1}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6">
              Chatbot Query Templates
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenDialog()}
            >
              New Template
            </Button>
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Create and manage reusable query templates for the chatbot. Use placeholders like
            {' {agent_name}'}, {' {time_period}'}, etc. to make templates dynamic.
          </Typography>

          {loading ? (
            <Typography>Loading templates...</Typography>
          ) : templates.length === 0 ? (
            <Alert severity="info">
              No query templates found. Create your first template to get started!
            </Alert>
          ) : (
            <Grid container spacing={2}>
              {templates.map((template) => (
                <Grid item xs={12} md={6} key={template.id}>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                        <Typography variant="h6" component="div">
                          {template.name}
                        </Typography>
                        <Chip
                          label={template.category}
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                      </Box>
                      
                      {template.description && (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          {template.description}
                        </Typography>
                      )}
                      
                      <Paper
                        sx={{
                          p: 1.5,
                          bgcolor: 'grey.100',
                          fontFamily: 'monospace',
                          fontSize: '0.875rem',
                          mt: 2,
                        }}
                      >
                        {template.template}
                      </Paper>
                    </CardContent>
                    
                    <CardActions>
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => handleOpenDialog(template)}
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDeleteTemplate(template.id)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </CardActions>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </TabPanel>

        {/* Notifications Tab */}
        <TabPanel value={tabValue} index={2}>
          <Typography variant="body1" color="text.secondary">
            Notification settings will be implemented here.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Features to be added:
          </Typography>
          <ul style={{ marginTop: '8px' }}>
            <li>Email notifications</li>
            <li>In-app notifications</li>
            <li>Alert thresholds</li>
            <li>Notification frequency</li>
          </ul>
        </TabPanel>

        {/* My Permissions Tab */}
        <TabPanel value={tabValue} index={3}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <SecurityIcon sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h6">
              My Permissions
            </Typography>
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            View your current role assignments and the permissions granted to your account.
          </Typography>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : userPermissions ? (
            <Grid container spacing={3}>
              {/* User Info Card */}
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Account Information
                    </Typography>
                    <Divider sx={{ mb: 2 }} />
                    <Stack spacing={1.5}>
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Email
                        </Typography>
                        <Typography variant="body1">
                          {userPermissions.user_email}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          User ID
                        </Typography>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                          {userPermissions.user_id}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Administrator
                        </Typography>
                        <Box>
                          <Chip
                            label={userPermissions.is_administrator ? 'Yes' : 'No'}
                            size="small"
                            color={userPermissions.is_administrator ? 'success' : 'default'}
                            sx={{ mt: 0.5 }}
                          />
                        </Box>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>

              {/* Roles Card */}
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Assigned Roles
                    </Typography>
                    <Divider sx={{ mb: 2 }} />
                    {userPermissions.roles.length === 0 ? (
                      <Alert severity="info">No roles assigned</Alert>
                    ) : (
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        {userPermissions.roles.map((role) => (
                          <Chip
                            key={role}
                            label={role}
                            color="primary"
                            variant="outlined"
                            sx={{ mb: 1 }}
                          />
                        ))}
                      </Stack>
                    )}
                  </CardContent>
                </Card>
              </Grid>

              {/* Permissions Card */}
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Permissions ({userPermissions.permissions.length})
                    </Typography>
                    <Divider sx={{ mb: 2 }} />
                    {userPermissions.permissions.length === 0 ? (
                      <Alert severity="warning">
                        No permissions granted. Please contact your administrator.
                      </Alert>
                    ) : (
                      <List>
                        {userPermissions.permissions.map((permission, index) => (
                          <Box key={permission}>
                            <ListItem>
                              <ListItemIcon>
                                <CheckCircleIcon color="success" />
                              </ListItemIcon>
                              <ListItemText
                                primary={
                                  <Typography variant="body1" sx={{ fontFamily: 'monospace' }}>
                                    {permission}
                                  </Typography>
                                }
                                secondary={getPermissionDescription(permission)}
                              />
                            </ListItem>
                            {index < userPermissions.permissions.length - 1 && <Divider variant="inset" component="li" />}
                          </Box>
                        ))}
                      </List>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          ) : (
            <Alert severity="info">
              Click to load your permission information
            </Alert>
          )}
        </TabPanel>
      </Paper>

      {/* Create/Edit Template Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingTemplate ? 'Edit Query Template' : 'New Query Template'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Template Name"
              fullWidth
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
            
            <TextField
              label="Description"
              fullWidth
              multiline
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
            
            <FormControl fullWidth>
              <InputLabel>Category</InputLabel>
              <Select
                value={formData.category}
                label="Category"
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              >
                <MenuItem value="General">General</MenuItem>
                <MenuItem value="Performance">Performance</MenuItem>
                <MenuItem value="Analytics">Analytics</MenuItem>
                <MenuItem value="Reports">Reports</MenuItem>
              </Select>
            </FormControl>
            
            <TextField
              label="Template"
              fullWidth
              multiline
              rows={4}
              value={formData.template}
              onChange={(e) => setFormData({ ...formData, template: e.target.value })}
              required
              helperText="Use {placeholder} syntax for dynamic values (e.g., {agent_name}, {time_period})"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSaveTemplate}
            disabled={!formData.name || !formData.template}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// Helper function to get human-readable permission descriptions
function getPermissionDescription(permission: string): string {
  const descriptions: Record<string, string> = {
    'dashboard:view': 'View dashboard and analytics',
    'dashboard:export': 'Export dashboard data',
    'chat:view': 'View chat conversations',
    'chat:create': 'Create and send chat messages',
    'chat:delete': 'Delete chat conversations',
    'powerbi:view': 'View Power BI reports',
    'powerbi:export': 'Export Power BI reports',
    'powerbi:refresh': 'Refresh Power BI data',
    'templates:view': 'View query templates',
    'templates:create': 'Create new query templates',
    'templates:update': 'Update existing query templates',
    'templates:delete': 'Delete query templates',
    'ai_foundry:query': 'Query AI Foundry agents',
    'ai_foundry:advanced': 'Access advanced AI Foundry features',
    'admin:users:view': 'View user information',
    'admin:users:manage': 'Manage users and their roles',
    'admin:roles:view': 'View role definitions',
    'admin:roles:manage': 'Manage roles and permissions',
    'admin:audit:view': 'View audit logs',
    'admin:config:view': 'View system configuration',
    'admin:config:manage': 'Manage system configuration',
  };
  
  return descriptions[permission] || 'Permission access';
}
