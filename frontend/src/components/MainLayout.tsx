import { ReactNode, useState, useEffect, useCallback } from 'react';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  useTheme,
  useMediaQuery,
  Collapse,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  Chat as ChatIcon,
  ChevronLeft as ChevronLeftIcon,
  ExpandLess,
  ExpandMore,
  History as HistoryIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  BarChart as BarChartIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMsal } from '@azure/msal-react';
import { TenantConfig } from '../theme/theme';
import apiClient from '../services/apiClient';
import { ConversationProvider, useConversationContext } from '../contexts/ConversationContext';
import { getLogoSrc } from '../config/tenantConfig';
import UserMenu from './UserMenu';
import { UIConfig, getTabConfig } from '../services/featureConfig';

// Chat History types (matching ChatHistoryDrawer)
interface ConversationSummary {
  id: string;
  conversation_id: string;
  title: string;
  last_message?: string;
  message_count: number;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

const drawerWidth = 260;

interface MainLayoutProps {
  children: ReactNode;
  tenantConfig: TenantConfig;
  uiConfig: UIConfig;
}

interface MainLayoutContentProps extends MainLayoutProps {
  refreshTrigger?: number;
}

function MainLayoutContent({ children, tenantConfig, uiConfig, refreshTrigger }: MainLayoutContentProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopOpen, setDesktopOpen] = useState(true);
  
  // Copilot Studio conversation state
  const [chatSubmenuOpen, setChatSubmenuOpen] = useState(false);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [conversationsError, setConversationsError] = useState<string | null>(null);
  const [showAllConversations, setShowAllConversations] = useState(false);
  
  // AI Foundry conversation state
  const [aiFoundrySubmenuOpen, setAiFoundrySubmenuOpen] = useState(false);
  const [aiFoundryConversations, setAiFoundryConversations] = useState<ConversationSummary[]>([]);
  const [aiFoundryConversationsLoading, setAiFoundryConversationsLoading] = useState(false);
  const [aiFoundryConversationsError, setAiFoundryConversationsError] = useState<string | null>(null);
  const [showAllAiFoundryConversations, setShowAllAiFoundryConversations] = useState(false);
  
  const navigate = useNavigate();
  const location = useLocation();
  const { accounts } = useMsal();
  const { currentConversationId: contextConversationId, setCurrentConversationId: setContextConversationId } = useConversationContext();

  // Auto-expand Chat History submenu when on chatbot page
  useEffect(() => {
    if (location.pathname === '/chatbot') {
      setChatSubmenuOpen(true);
      if (conversations.length === 0) {
        loadConversations();
      }
    } else if (location.pathname === '/ai-foundry') {
      setAiFoundrySubmenuOpen(true);
      if (aiFoundryConversations.length === 0) {
        loadAiFoundryConversations();
      }
    }
  }, [location.pathname]);

  // Handle refresh trigger from ConversationContext
  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      // Refresh the appropriate conversation list based on current page
      if (location.pathname === '/chatbot') {
        loadConversations();
      } else if (location.pathname === '/ai-foundry') {
        loadAiFoundryConversations();
      }
    }
  }, [refreshTrigger, location.pathname]);

  const handleDrawerToggle = () => {
    if (isMobile) {
      setMobileOpen(!mobileOpen);
    } else {
      setDesktopOpen(!desktopOpen);
    }
  };

  // Load conversations when chat submenu is opened
  const loadConversations = useCallback(async () => {
    if (conversationsLoading) return;

    setConversationsLoading(true);
    setConversationsError(null);
    
    try {
      // Get Copilot Studio agent ID from environment or use the configured schema name
      const copilotAgentId = import.meta.env.VITE_COPILOT_STUDIO_SCHEMA_NAME || 'crb64_myAgent';
      const response = await apiClient.get('/api/chat/conversations', {
        params: { agent_id: copilotAgentId }
      });
      setConversations(response.data);
    } catch (error: any) {
      setConversationsError('Failed to load conversations');
      console.error('Failed to load conversations:', error);
    } finally {
      setConversationsLoading(false);
    }
  }, [conversationsLoading]);

  const loadAiFoundryConversations = useCallback(async () => {
    if (aiFoundryConversationsLoading) return;

    setAiFoundryConversationsLoading(true);
    setAiFoundryConversationsError(null);
    
    try {
      // First, get the session to retrieve the actual agent ID from backend
      let aiFoundryAgentId = import.meta.env.VITE_AI_FOUNDRY_AGENT_ID;
      
      try {
        const sessionResponse = await apiClient.post<{agentId: string}>('/api/ai-foundry/token');
        if (sessionResponse.data?.agentId) {
          aiFoundryAgentId = sessionResponse.data.agentId;
        }
      } catch (sessionError) {
        console.warn('Could not fetch AI Foundry session, using fallback agent ID');
      }
      
      // Use the actual agent ID from backend or fallback
      const response = await apiClient.get('/api/chat/conversations', {
        params: { agent_id: aiFoundryAgentId }
      });
      setAiFoundryConversations(response.data);
    } catch (error: any) {
      setAiFoundryConversationsError('Failed to load AI Foundry conversations');
      console.error('Failed to load AI Foundry conversations:', error);
    } finally {
      setAiFoundryConversationsLoading(false);
    }
  }, [aiFoundryConversationsLoading]);

  const handleChatSubmenuToggle = () => {
    const newOpen = !chatSubmenuOpen;
    setChatSubmenuOpen(newOpen);
    
    if (newOpen && conversations.length === 0) {
      loadConversations();
    }
  };

  const handleAiFoundrySubmenuToggle = () => {
    const newOpen = !aiFoundrySubmenuOpen;
    setAiFoundrySubmenuOpen(newOpen);
    
    if (newOpen && aiFoundryConversations.length === 0) {
      loadAiFoundryConversations();
    }
  };

  const handleConversationSelect = (conversation: ConversationSummary) => {
    // Set the context conversation ID immediately for active state
    setContextConversationId(conversation.id);
    navigate('/chatbot', { state: { conversationId: conversation.id } });
    if (isMobile) setMobileOpen(false);
  };

  const handleAiFoundryConversationSelect = (conversation: ConversationSummary) => {
    // Set the context conversation ID immediately for active state
    setContextConversationId(conversation.id);
    navigate('/ai-foundry', { state: { conversationId: conversation.id } });
    if (isMobile) setMobileOpen(false);
  };

  const handleNewConversation = () => {
    // Clear the context conversation ID for new chat
    setContextConversationId(null);
    // Navigate to chatbot with new conversation flag
    navigate('/chatbot', { state: { newConversation: true }, replace: true });
    if (isMobile) setMobileOpen(false);
  };

  const handleNewAiFoundryConversation = () => {
    // Clear the context conversation ID for new chat
    setContextConversationId(null);
    // Navigate to AI Foundry with new conversation flag
    navigate('/ai-foundry', { state: { newConversation: true }, replace: true });
    if (isMobile) setMobileOpen(false);
  };

  const handleDeleteConversation = async (conversationId: string) => {
    try {
      await apiClient.delete(`/api/chat/conversations/${conversationId}`);
      setConversations(prev => prev.filter(conv => conv.id !== conversationId));
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  };

  const handleDeleteAiFoundryConversation = async (conversationId: string) => {
    try {
      await apiClient.delete(`/api/chat/conversations/${conversationId}`);
      setAiFoundryConversations(prev => prev.filter(conv => conv.id !== conversationId));
    } catch (error) {
      console.error('Failed to delete AI Foundry conversation:', error);
    }
  };

  // Build menu items based on UI configuration
  const menuItems = [];
  
  const dashboardTab = getTabConfig(uiConfig, 'dashboard');
  if (dashboardTab?.display) {
    menuItems.push({ 
      text: dashboardTab.labels.name, 
      icon: <DashboardIcon />, 
      path: '/dashboard' 
    });
  }
  
  const powerbiTab = getTabConfig(uiConfig, 'powerbi');
  if (powerbiTab?.display) {
    menuItems.push({ 
      text: powerbiTab.labels.name, 
      icon: <BarChartIcon />, 
      path: '/powerbi' 
    });
  }

  const drawer = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Logo Section */}
      <Box
        sx={{
          p: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 64,
        }}
      >
        {getLogoSrc(tenantConfig) ? (
          <img
            src={getLogoSrc(tenantConfig)}
            alt={tenantConfig.name}
            style={{ maxHeight: 40, maxWidth: '100%', objectFit: 'contain' }}
          />
        ) : (
          <Box
            sx={{
              width: 120,
              height: 40,
              bgcolor: 'primary.main',
              borderRadius: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: 600,
            }}
          >
            LOGO
          </Box>
        )}
      </Box>

      <Divider />

      {/* Navigation Menu */}
      <List sx={{ flexGrow: 1, pt: 2 }}>
        {/* Dashboard */}
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding sx={{ px: 1 }}>
            <ListItemButton
              selected={location.pathname === item.path}
              onClick={() => {
                navigate(item.path);
                if (isMobile) setMobileOpen(false);
              }}
              sx={{
                borderRadius: 1,
                mb: 0.5,
                '&.Mui-selected': {
                  bgcolor: 'primary.main',
                  color: 'white',
                  '&:hover': {
                    bgcolor: 'primary.dark',
                  },
                  '& .MuiListItemIcon-root': {
                    color: 'white',
                  },
                },
              }}
            >
              <ListItemIcon
                sx={{
                  color: location.pathname === item.path ? 'white' : 'inherit',
                }}
              >
                {item.icon}
              </ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}

        {/* Copilot Studio Chatbot with Submenu */}
        {getTabConfig(uiConfig, 'copilot-studio')?.display && (
          <>
            <ListItem disablePadding sx={{ px: 1 }}>
              <ListItemButton
                selected={location.pathname === '/chatbot'}
                onClick={() => {
                  navigate('/chatbot');
                  if (isMobile) setMobileOpen(false);
                }}
                sx={{
                  borderRadius: 1,
                  mb: 0.5,
                  '&.Mui-selected': {
                    bgcolor: 'primary.main',
                    color: 'white',
                    '&:hover': {
                      bgcolor: 'primary.dark',
                    },
                    '& .MuiListItemIcon-root': {
                      color: 'white',
                    },
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    color: location.pathname === '/chatbot' ? 'white' : 'inherit',
                  }}
                >
                  <ChatIcon />
                </ListItemIcon>
                <ListItemText primary={getTabConfig(uiConfig, 'copilot-studio')?.labels.name} />
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleChatSubmenuToggle();
                  }}
                  sx={{
                    color: location.pathname === '/chatbot' ? 'white' : 'inherit',
                    '&:hover': {
                      bgcolor: 'rgba(0, 0, 0, 0.04)',
                    },
                  }}
                >
                  {chatSubmenuOpen ? <ExpandLess /> : <ExpandMore />}
                </IconButton>
              </ListItemButton>
            </ListItem>

            {/* Chat History Submenu */}
            <Collapse in={chatSubmenuOpen} timeout="auto" unmountOnExit>
          <List component="div" disablePadding sx={{ pl: 1 }}>
            {/* Chat History Header with better spacing */}
            <ListItem disablePadding sx={{ px: 1 }}>
              <ListItemButton
                onClick={handleNewConversation}
                sx={{
                  borderRadius: 1,
                  mb: 0.5,
                  pl: 3,
                  minHeight: 40,
                  '&:hover': {
                    bgcolor: 'grey.100',
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <AddIcon fontSize="small" color="primary" />
                </ListItemIcon>
                <ListItemText 
                  primary="New Chat" 
                  primaryTypographyProps={{
                    variant: 'body2',
                    fontWeight: 500,
                  }}
                />
              </ListItemButton>
            </ListItem>

            {/* Chat History Section Label */}
            <ListItem sx={{ px: 1, pt: 1, pb: 0.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', pl: 3 }}>
                <HistoryIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                  RECENT CONVERSATIONS
                </Typography>
              </Box>
            </ListItem>

            {/* Loading State */}
            {conversationsLoading && (
              <ListItem sx={{ px: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', py: 2 }}>
                  <CircularProgress size={20} />
                </Box>
              </ListItem>
            )}

            {/* Error State */}
            {conversationsError && (
              <ListItem sx={{ px: 1 }}>
                <Alert severity="error" sx={{ width: '100%', fontSize: '0.75rem' }}>
                  {conversationsError}
                </Alert>
              </ListItem>
            )}

            {/* Conversations List */}
            {!conversationsLoading && !conversationsError && conversations
              .slice(0, showAllConversations ? conversations.length : 5)
              .map((conversation) => {
                const isActive = location.pathname === '/chatbot' && 
                                (location.state?.conversationId === conversation.id || 
                                 contextConversationId === conversation.id);
                
                return (
                  <ListItem key={conversation.id} disablePadding sx={{ px: 1 }}>
                    <ListItemButton
                      onClick={() => handleConversationSelect(conversation)}
                      sx={{
                        borderRadius: 1,
                        mb: 0.5,
                        pl: 3,
                        pr: 1,
                        minHeight: 40,
                        position: 'relative',
                        bgcolor: isActive ? 'action.selected' : 'transparent',
                        '&:hover': {
                          bgcolor: isActive ? 'action.selected' : 'grey.100',
                          '& .delete-button': {
                            opacity: 1,
                          },
                        },
                        '&:before': isActive ? {
                          content: '""',
                          position: 'absolute',
                          left: 0,
                          top: 0,
                          bottom: 0,
                          width: 3,
                          bgcolor: 'primary.main',
                          borderRadius: '0 3px 3px 0',
                        } : {},
                      }}
                    >
                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Typography 
                          variant="body2" 
                          noWrap 
                          sx={{ 
                            fontSize: '0.875rem',
                            fontWeight: isActive ? 500 : 400,
                            color: isActive ? 'primary.main' : 'text.primary',
                          }}
                        >
                          {conversation.title}
                        </Typography>
                      </Box>
                      <IconButton
                        className="delete-button"
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteConversation(conversation.id);
                        }}
                        sx={{
                          opacity: 0,
                          transition: 'opacity 0.2s',
                          color: 'error.main',
                        }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </ListItemButton>
                  </ListItem>
                );
              })}

            {/* Load More/Show Less Button */}
            {!conversationsLoading && !conversationsError && conversations.length > 5 && (
              <ListItem disablePadding sx={{ px: 1 }}>
                <ListItemButton
                  onClick={() => setShowAllConversations(!showAllConversations)}
                  sx={{
                    borderRadius: 1,
                    mb: 0.5,
                    pl: 3,
                    minHeight: 36,
                    '&:hover': {
                      bgcolor: 'grey.100',
                    },
                  }}
                >
                  <ListItemText 
                    primary={showAllConversations ? 'Show less' : `Load more (${conversations.length - 5} more)`}
                    primaryTypographyProps={{
                      variant: 'caption',
                      color: 'primary.main',
                      fontWeight: 500,
                    }}
                  />
                </ListItemButton>
              </ListItem>
            )}

            {/* No Conversations Message */}
            {!conversationsLoading && !conversationsError && conversations.length === 0 && (
              <ListItem sx={{ px: 1 }}>
                <Typography variant="body2" color="text.secondary" sx={{ pl: 3, fontSize: '0.75rem', fontStyle: 'italic' }}>
                  No conversations yet. Start a new chat!
                </Typography>
              </ListItem>
            )}
          </List>
        </Collapse>
        </>
        )}

        {/* AI Foundry Chatbot with Submenu */}
        {getTabConfig(uiConfig, 'ai-foundry')?.display && (
          <>
            <ListItem disablePadding sx={{ px: 1 }}>
              <ListItemButton
                selected={location.pathname === '/ai-foundry'}
                onClick={() => {
                  navigate('/ai-foundry');
                  if (isMobile) setMobileOpen(false);
                }}
                sx={{
                  borderRadius: 1,
                  mb: 0.5,
                  '&.Mui-selected': {
                    bgcolor: 'primary.main',
                    color: 'white',
                    '&:hover': {
                      bgcolor: 'primary.dark',
                    },
                    '& .MuiListItemIcon-root': {
                      color: 'white',
                    },
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    color: location.pathname === '/ai-foundry' ? 'white' : 'inherit',
                  }}
                >
                  <ChatIcon />
                </ListItemIcon>
                <ListItemText primary={getTabConfig(uiConfig, 'ai-foundry')?.labels.name} />
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAiFoundrySubmenuToggle();
                  }}
                  sx={{
                    color: location.pathname === '/ai-foundry' ? 'white' : 'inherit',
                    '&:hover': {
                      bgcolor: 'rgba(0, 0, 0, 0.04)',
                    },
                  }}
                >
                  {aiFoundrySubmenuOpen ? <ExpandLess /> : <ExpandMore />}
                </IconButton>
              </ListItemButton>
            </ListItem>

            {/* AI Foundry History Submenu */}
            <Collapse in={aiFoundrySubmenuOpen} timeout="auto" unmountOnExit>
          <List component="div" disablePadding sx={{ pl: 1 }}>
            {/* New Chat Button */}
            <ListItem disablePadding sx={{ px: 1 }}>
              <ListItemButton
                onClick={handleNewAiFoundryConversation}
                sx={{
                  borderRadius: 1,
                  mb: 0.5,
                  pl: 3,
                  minHeight: 40,
                  '&:hover': {
                    bgcolor: 'grey.100',
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <AddIcon fontSize="small" color="primary" />
                </ListItemIcon>
                <ListItemText 
                  primary="New AI Foundry Chat" 
                  primaryTypographyProps={{
                    variant: 'body2',
                    fontWeight: 500,
                  }}
                />
              </ListItemButton>
            </ListItem>

            {/* History Section Label */}
            <ListItem sx={{ px: 1, pt: 1, pb: 0.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', pl: 3 }}>
                <HistoryIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                  RECENT CONVERSATIONS
                </Typography>
              </Box>
            </ListItem>

            {/* Loading State */}
            {aiFoundryConversationsLoading && (
              <ListItem sx={{ px: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', py: 2 }}>
                  <CircularProgress size={20} />
                </Box>
              </ListItem>
            )}

            {/* Error State */}
            {aiFoundryConversationsError && (
              <ListItem sx={{ px: 1 }}>
                <Alert severity="error" sx={{ width: '100%', fontSize: '0.75rem' }}>
                  {aiFoundryConversationsError}
                </Alert>
              </ListItem>
            )}

            {/* Conversations List */}
            {!aiFoundryConversationsLoading && !aiFoundryConversationsError && aiFoundryConversations
              .slice(0, showAllAiFoundryConversations ? aiFoundryConversations.length : 5)
              .map((conversation) => {
                const isActive = location.pathname === '/ai-foundry' && 
                                (location.state?.conversationId === conversation.id || 
                                 contextConversationId === conversation.id);
                
                return (
                  <ListItem key={conversation.id} disablePadding sx={{ px: 1 }}>
                    <ListItemButton
                      onClick={() => handleAiFoundryConversationSelect(conversation)}
                      sx={{
                        borderRadius: 1,
                        mb: 0.5,
                        pl: 3,
                        pr: 1,
                        minHeight: 40,
                        position: 'relative',
                        bgcolor: isActive ? 'action.selected' : 'transparent',
                        '&:hover': {
                          bgcolor: isActive ? 'action.selected' : 'grey.100',
                          '& .delete-button': {
                            opacity: 1,
                          },
                        },
                        '&:before': isActive ? {
                          content: '""',
                          position: 'absolute',
                          left: 0,
                          top: 0,
                          bottom: 0,
                          width: 3,
                          bgcolor: 'primary.main',
                          borderRadius: '0 3px 3px 0',
                        } : {},
                      }}
                    >
                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Typography 
                          variant="body2" 
                          noWrap 
                          sx={{ 
                            fontSize: '0.875rem',
                            fontWeight: isActive ? 500 : 400,
                            color: isActive ? 'primary.main' : 'text.primary',
                          }}
                        >
                          {conversation.title}
                        </Typography>
                      </Box>
                      <IconButton
                        className="delete-button"
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteAiFoundryConversation(conversation.id);
                        }}
                        sx={{
                          opacity: 0,
                          transition: 'opacity 0.2s',
                          color: 'error.main',
                        }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </ListItemButton>
                  </ListItem>
                );
              })}

            {/* Load More/Show Less Button */}
            {!aiFoundryConversationsLoading && !aiFoundryConversationsError && aiFoundryConversations.length > 5 && (
              <ListItem disablePadding sx={{ px: 1 }}>
                <ListItemButton
                  onClick={() => setShowAllAiFoundryConversations(!showAllAiFoundryConversations)}
                  sx={{
                    borderRadius: 1,
                    mb: 0.5,
                    pl: 3,
                    minHeight: 36,
                    '&:hover': {
                      bgcolor: 'grey.100',
                    },
                  }}
                >
                  <ListItemText 
                    primary={showAllAiFoundryConversations ? 'Show less' : `Load more (${aiFoundryConversations.length - 5} more)`}
                    primaryTypographyProps={{
                      variant: 'caption',
                      color: 'primary.main',
                      fontWeight: 500,
                    }}
                  />
                </ListItemButton>
              </ListItem>
            )}

            {/* No Conversations Message */}
            {!aiFoundryConversationsLoading && !aiFoundryConversationsError && aiFoundryConversations.length === 0 && (
              <ListItem sx={{ px: 1 }}>
                <Typography variant="body2" color="text.secondary" sx={{ pl: 3, fontSize: '0.75rem', fontStyle: 'italic' }}>
                  No conversations yet. Start a new AI Foundry chat!
                </Typography>
              </ListItem>
            )}
          </List>
        </Collapse>
        </>
        )}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* App Bar */}
      <AppBar
        position="fixed"
        sx={{
          width: {
            md: desktopOpen ? `calc(100% - ${drawerWidth}px)` : '100%',
          },
          ml: {
            md: desktopOpen ? `${drawerWidth}px` : 0,
          },
          transition: theme.transitions.create(['width', 'margin'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2 }}
          >
            {(isMobile ? mobileOpen : desktopOpen) ? <ChevronLeftIcon /> : <MenuIcon />}
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            {tenantConfig.name}
          </Typography>
          
          {/* User Menu in Header */}
          <UserMenu 
            userInitials={accounts[0]?.name?.charAt(0) || 'U'}
            userName={accounts[0]?.name || 'User'}
            userEmail={accounts[0]?.username || ''}
          />
        </Toolbar>
      </AppBar>

      {/* Sidebar Drawer */}
      <Box
        component="nav"
        sx={{
          width: { md: desktopOpen ? drawerWidth : 0 },
          flexShrink: { md: 0 },
        }}
      >
        {/* Mobile drawer */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better mobile performance
          }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
            },
          }}
        >
          {drawer}
        </Drawer>

        {/* Desktop drawer */}
        <Drawer
          variant="persistent"
          open={desktopOpen}
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
            },
          }}
        >
          {drawer}
        </Drawer>
      </Box>

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: {
            md: desktopOpen ? `calc(100% - ${drawerWidth}px)` : '100%',
          },
          transition: theme.transitions.create(['width'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
        }}
      >
        <Toolbar /> {/* Spacer for AppBar */}
        {children}
      </Box>
    </Box>
  );
}

// Wrapper component that provides ConversationContext
const MainLayout: React.FC<MainLayoutProps> = (props) => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleRefreshConversations = async () => {
    // Trigger refresh in MainLayoutContent
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <ConversationProvider onRefreshConversations={handleRefreshConversations}>
      <MainLayoutContent {...props} refreshTrigger={refreshTrigger} />
    </ConversationProvider>
  );
};

export default MainLayout;
