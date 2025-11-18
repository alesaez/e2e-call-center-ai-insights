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
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import apiClient from '../services/apiClient';

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

export default function SettingsPage() {
  const [tabValue, setTabValue] = useState(0);
  const [templates, setTemplates] = useState<QueryTemplate[]>([]);
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
