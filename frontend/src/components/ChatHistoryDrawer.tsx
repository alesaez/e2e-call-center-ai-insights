import React from 'react';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Typography,
  Box,
  Divider,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Chat as ChatIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  AccessTime as TimeIcon,
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';

export interface ConversationSummary {
  id: string;
  conversation_id: string;
  title: string;
  last_message?: string;
  message_count: number;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

interface ChatHistoryDrawerProps {
  open: boolean;
  onClose: () => void;
  conversations: ConversationSummary[];
  loading: boolean;
  error: string | null;
  onSelectConversation: (conversation: ConversationSummary) => void;
  onCreateNew: () => void;
  onDeleteConversation: (conversationId: string) => void;
  currentConversationId?: string | null;
}

export default function ChatHistoryDrawer({
  open,
  onClose,
  conversations,
  loading,
  error,
  onSelectConversation,
  onCreateNew,
  onDeleteConversation,
  currentConversationId,
}: ChatHistoryDrawerProps) {
  const theme = useTheme();

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const truncateText = (text: string, maxLength: number = 50) => {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  return (
    <Drawer
      anchor="left"
      open={open}
      onClose={onClose}
      sx={{
        '& .MuiDrawer-paper': {
          width: 320,
          boxSizing: 'border-box',
          top: 64, // Account for AppBar height
          height: 'calc(100% - 64px)',
        },
      }}
    >
      <Box sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6" component="div">
            Chat History
          </Typography>
          <Tooltip title="New Conversation">
            <IconButton 
              onClick={onCreateNew}
              color="primary"
              size="small"
            >
              <AddIcon />
            </IconButton>
          </Tooltip>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {conversations.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                <ChatIcon sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
                <Typography variant="body2">
                  No conversations yet.
                  Start a new chat!
                </Typography>
              </Box>
            ) : (
              <List sx={{ p: 0 }}>
                {conversations.map((conversation, index) => (
                  <React.Fragment key={conversation.id}>
                    <ListItem 
                      disablePadding
                      sx={{
                        '&:hover .delete-button': {
                          visibility: 'visible',
                        },
                      }}
                    >
                      <ListItemButton
                        selected={conversation.conversation_id === currentConversationId}
                        onClick={() => onSelectConversation(conversation)}
                        sx={{
                          borderRadius: 1,
                          mb: 0.5,
                          '&.Mui-selected': {
                            bgcolor: theme.palette.primary.light,
                            '&:hover': {
                              bgcolor: theme.palette.primary.light,
                            },
                          },
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          <ChatIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Typography variant="subtitle2" noWrap>
                              {truncateText(conversation.title)}
                            </Typography>
                          }
                          secondary={
                            <Box>
                              {conversation.last_message && (
                                <Typography 
                                  variant="caption" 
                                  color="text.secondary"
                                  sx={{ display: 'block' }}
                                  noWrap
                                >
                                  {truncateText(conversation.last_message, 35)}
                                </Typography>
                              )}
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                                <TimeIcon sx={{ fontSize: 12 }} />
                                <Typography variant="caption" color="text.secondary">
                                  {formatDate(conversation.updated_at)}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  • {conversation.message_count} msg{conversation.message_count !== 1 ? 's' : ''}
                                </Typography>
                              </Box>
                            </Box>
                          }
                        />
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteConversation(conversation.id);
                          }}
                          className="delete-button"
                          sx={{
                            visibility: 'hidden',
                            color: 'error.main',
                            '&:hover': {
                              bgcolor: 'error.light',
                            },
                          }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </ListItemButton>
                    </ListItem>
                    {index < conversations.length - 1 && <Divider sx={{ my: 0.5 }} />}
                  </React.Fragment>
                ))}
              </List>
            )}
          </>
        )}
      </Box>
    </Drawer>
  );
}