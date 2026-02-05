import { useEffect, useState, useRef, Component, ErrorInfo, ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useConversationContext } from '../contexts/ConversationContext';
import {
  Box,
  Typography,
  Paper,
  Alert,
  AlertTitle,
  CircularProgress,
  TextField,
  Button,
  List,
  ListItem,
  Avatar,
  Chip,
  Stack,
  IconButton,
  Tooltip,
  Card,
  CardContent,
  Grid,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Send as SendIcon,
  SmartToy as BotIcon,
  Person as PersonIcon,
  QuestionMark as QuestionIcon,
  ContentCopy as CopyIcon,
  Edit as EditIcon,
  ThumbUp as ThumbUpIcon,
  ThumbDown as ThumbDownIcon,
  ThumbUpOutlined as ThumbUpOutlinedIcon,
  ThumbDownOutlined as ThumbDownOutlinedIcon,
} from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import apiClient from '../services/apiClient';
import QuestionCards from './QuestionCards';
import ReferenceProcessor from './ReferenceProcessor';
import { UIConfig, getTabConfig } from '../services/featureConfig';

// Error Boundary Component
interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class MessageListErrorBoundary extends Component<
  { children: ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('❌ Message rendering error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ p: 2, textAlign: 'center' }}>
          <Alert severity="error">
            <AlertTitle>Message Rendering Error</AlertTitle>
            There was an error displaying messages. Please refresh the page or try starting a new conversation.
          </Alert>
        </Box>
      );
    }

    return this.props.children;
  }
}

interface AIFoundrySession {
  conversationId: string;
  userId: string;
  userName: string;
  projectName: string;
  agentId: string;
  expiresIn: number;
  sessionCreated: boolean;
  welcomeMessage: string;
}

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  attachments?: MessageAttachment[];
  suggestedQuestions?: string[]; // Follow-up questions suggested by the bot
  feedback?: 'positive' | 'negative' | null; // User feedback for bot messages
}

interface MessageAttachment {
  contentType: string;
  content?: any;
  name?: string;
  url?: string;      // For url_citation type
  title?: string;    // For url_citation type
  text?: string;     // Original annotation text
  fileId?: string;   // For file_citation type
  quote?: string;    // For file_citation type
}

// Helper function to format message timestamps based on age
const formatMessageTimestamp = (timestamp: Date): string => {
  if (!(timestamp instanceof Date) || isNaN(timestamp.getTime())) {
    return 'Invalid time';
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const oneWeekAgo = new Date(today);
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const messageDate = new Date(timestamp.getFullYear(), timestamp.getMonth(), timestamp.getDate());

  // Today: show time only
  if (messageDate.getTime() === today.getTime()) {
    return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // Yesterday
  if (messageDate.getTime() === yesterday.getTime()) {
    return 'Yesterday';
  }

  // Within the last week: show day name
  if (messageDate.getTime() > oneWeekAgo.getTime()) {
    return timestamp.toLocaleDateString([], { weekday: 'long' });
  }

  // Older than a week: show full date
  return timestamp.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
};

// Markdown renderer component with custom styling
const MarkdownMessage = ({ text, isUser }: { text: string; isUser: boolean }) => {
  const theme = useTheme();
  
  // Allow data URIs for inline visualization images
  const urlTransform = (url: string) => {
    // Allow data URIs (for inline visualizations)
    if (url.startsWith('data:image/')) {
      return url;
    }
    // For other URLs, return as-is (could add validation here)
    return url;
  };
  
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      urlTransform={urlTransform}
      components={{
        // Custom link styling - small clickable bubbles
        a: ({ ...props }) => (
          <Box
            component="a"
            href={props.href}
            target="_blank"
            rel="noopener noreferrer"
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.5,
              px: 1,
              py: 0.25,
              mx: 0.25,
              backgroundColor: isUser 
                ? 'rgba(255,255,255,0.2)' 
                : theme.palette.primary.main,
              color: isUser 
                ? theme.palette.primary.contrastText 
                : theme.palette.primary.contrastText,
              borderRadius: 2,
              fontSize: '0.8em',
              fontWeight: 500,
              textDecoration: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s ease-in-out',
              '&:hover': {
                backgroundColor: isUser 
                  ? 'rgba(255,255,255,0.3)' 
                  : theme.palette.primary.dark,
                transform: 'translateY(-1px)',
                boxShadow: theme.shadows[2],
              },
              '&:active': {
                transform: 'translateY(0)',
              },
            }}
          >
            <Box component="span" sx={{ fontSize: '0.7em' }}>
              🔗
            </Box>
            {props.children}
          </Box>
        ),
        // Custom paragraph styling with reference processing
        p: ({ ...props }) => (
          <Box
            sx={{
              display: 'block',
              mb: 1,
              '&:last-child': { mb: 0 },
            }}
          >
            <ReferenceProcessor isUser={isUser}>
              {props.children}
            </ReferenceProcessor>
          </Box>
        ),
        // Custom list styling
        ul: ({ ...props }) => (
          <Box
            component="ul"
            sx={{
              mt: 0.5,
              mb: 0.5,
              pl: 2,
              '&:last-child': { mb: 0 },
            }}
          >
            {props.children}
          </Box>
        ),
        ol: ({ ...props }) => (
          <Box
            component="ol"
            sx={{
              mt: 0.5,
              mb: 0.5,
              pl: 2,
              '&:last-child': { mb: 0 },
            }}
          >
            {props.children}
          </Box>
        ),
        li: ({ ...props }) => (
          <Box component="li" sx={{ mb: 0.25 }}>
            <Typography variant="body2" component="span">
              {props.children}
            </Typography>
          </Box>
        ),
        // Custom heading styling
        h1: ({ ...props }) => (
          <Typography variant="h6" sx={{ mt: 1, mb: 0.5, fontWeight: 'bold' }}>
            {props.children}
          </Typography>
        ),
        h2: ({ ...props }) => (
          <Typography variant="subtitle1" sx={{ mt: 1, mb: 0.5, fontWeight: 'bold' }}>
            {props.children}
          </Typography>
        ),
        h3: ({ ...props }) => (
          <Typography variant="subtitle2" sx={{ mt: 0.5, mb: 0.5, fontWeight: 'bold' }}>
            {props.children}
          </Typography>
        ),
        // Custom code block styling
        code: ({ inline, ...props }: any) => (
          inline ? (
            <Box
              component="code"
              sx={{
                bgcolor: isUser ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.05)',
                px: 0.5,
                py: 0.25,
                borderRadius: 0.5,
                fontFamily: 'monospace',
                fontSize: '0.9em',
              }}
            >
              {props.children}
            </Box>
          ) : (
            <Box
              component="pre"
              sx={{
                bgcolor: isUser ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.05)',
                p: 1,
                borderRadius: 1,
                overflow: 'auto',
                my: 1,
              }}
            >
              <Box component="code" sx={{ fontFamily: 'monospace', fontSize: '0.9em' }}>
                {props.children}
              </Box>
            </Box>
          )
        ),
        // Custom strong (bold) styling
        strong: ({ ...props }) => (
          <Box component="strong" sx={{ fontWeight: 'bold' }}>
            {props.children}
          </Box>
        ),
        // Custom emphasis (italic) styling
        em: ({ ...props }) => (
          <Box component="em" sx={{ fontStyle: 'italic' }}>
            {props.children}
          </Box>
        ),
        // Custom image rendering for data URIs (visualizations)
        img: ({ ...props }) => {
          return (
            <Box
              sx={{
                display: 'block',
                mt: 2,
                mb: 2,
                maxWidth: '100%',
              }}
            >
              <img
                src={props.src}
                alt={props.alt || 'Visualization'}
                style={{
                  maxWidth: '100%',
                  height: 'auto',
                  borderRadius: '8px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                }}
              />
            </Box>
          );
        },
      }}
    >
      {text}
    </ReactMarkdown>
  );
};

// Adaptive Card renderer component
const AdaptiveCardRenderer = ({ 
  card, 
  onAction 
}: { 
  card: any; 
  onAction: (action: string, data: any) => void;
}) => {
  const theme = useTheme();

  // Render TextBlock elements
  const renderTextBlock = (element: any, index: number) => {
    const variant = element.size === 'medium' ? 'body1' : 
                   element.size === 'large' ? 'h6' : 'body2';
    const fontWeight = element.weight === 'bolder' ? 'bold' : 'normal';
    const color = element.isSubtle ? 'text.secondary' : 'text.primary';

    return (
      <Typography
        key={index}
        variant={variant}
        sx={{
          fontWeight,
          color,
          mb: 1,
          whiteSpace: 'pre-wrap',
        }}
      >
        {element.text}
      </Typography>
    );
  };

  // Render Image elements
  const renderImage = (element: any, index: number) => (
    <Box
      key={index}
      component="img"
      src={element.url}
      alt={element.altText || 'Image'}
      sx={{
        width: element.width || 'auto',
        height: element.height || 'auto',
        maxWidth: element.size === 'small' ? 24 : 
                 element.size === 'medium' ? 48 : 'auto',
        mr: 1,
      }}
    />
  );

  // Render ColumnSet elements
  const renderColumnSet = (element: any, index: number) => (
    <Grid container key={index} spacing={1} sx={{ mb: 1 }}>
      {element.columns.map((column: any, colIndex: number) => (
        <Grid 
          item 
          key={colIndex}
          xs={column.width === 'auto' ? 'auto' : 
              column.width === 'stretch' ? true : 
              parseInt(column.width) || 12}
        >
          {column.items.map((item: any, itemIndex: number) => 
            renderElement(item, itemIndex)
          )}
        </Grid>
      ))}
    </Grid>
  );

  // Render ActionSet elements
  const renderActionSet = (element: any, index: number) => (
    <Box key={index} sx={{ display: 'flex', gap: 1, mb: 1 }}>
      {element.actions.map((action: any, actionIndex: number) => (
        <Button
          key={actionIndex}
          variant={action.style === 'positive' ? 'contained' : 'outlined'}
          color={action.style === 'positive' ? 'primary' : 'inherit'}
          size="small"
          onClick={() => {
            console.log('🔘 Button clicked:', { actionType: action.type, actionData: action.data });
            onAction(action.type, action.data);
          }}
          sx={{
            textTransform: 'none',
            borderRadius: 2,
            px: 2,
          }}
        >
          {action.title}
        </Button>
      ))}
    </Box>
  );

  // Main element renderer
  const renderElement = (element: any, index: number) => {
    switch (element.type) {
      case 'TextBlock':
        return renderTextBlock(element, index);
      case 'Image':
        return renderImage(element, index);
      case 'ColumnSet':
        return renderColumnSet(element, index);
      case 'ActionSet':
        return renderActionSet(element, index);
      default:
        return null;
    }
  };

  return (
    <Card 
      variant="outlined" 
      sx={{ 
        maxWidth: '100%',
        borderRadius: 2,
        border: `1px solid ${theme.palette.divider}`,
        boxShadow: 'none',
      }}
    >
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        {card.body?.map((element: any, index: number) => 
          renderElement(element, index)
        )}
      </CardContent>
    </Card>
  );
};

interface AIFoundryPageProps {
  uiConfig: UIConfig;
}

export default function AIFoundryPage({ uiConfig }: AIFoundryPageProps) {
  const theme = useTheme();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastUserMessageRef = useRef<HTMLLIElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { refreshConversations, setCurrentConversationId: setContextConversationId } = useConversationContext();
  const forceNewConversationRef = useRef<boolean>(false); // Track if we should force a new conversation
  const processedNewConversationRef = useRef<boolean>(false); // Track if we've processed a new conversation request
  const [session, setSession] = useState<AIFoundrySession | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showQuestions, setShowQuestions] = useState(true);
  const [activeSuggestions, setActiveSuggestions] = useState<string[]>([]);
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  
  // Chat history state (managed by sidebar now, but we still need conversations for navigation handling)


  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [currentConversationTitle, setCurrentConversationTitle] = useState<string | null>(null);

  // Message action handlers
  const handleCopyMessage = async (text: string, messageId: string) => {
    try {
      // Find the rendered message content element and copy its text (preserves formatting without markdown)
      const messageElement = document.querySelector(`[data-message-id="${messageId}"] .message-content`) as HTMLElement | null;
      if (messageElement) {
        const plainText = messageElement.innerText || messageElement.textContent || text;
        await navigator.clipboard.writeText(plainText);
      } else {
        // Fallback to raw text if element not found
        await navigator.clipboard.writeText(text);
      }
      // Could add a toast notification here
    } catch (err) {
      console.error('Failed to copy message:', err);
    }
  };

  const handleEditMessage = (text: string) => {
    setInputText(text);
  };

  const handleMessageFeedback = async (messageId: string, feedback: 'positive' | 'negative' | null) => {
    if (!currentConversationId) return;
    
    try {
      // Find the current message to check existing feedback
      const currentMessage = messages.find(m => m.id === messageId);
      const currentFeedback = currentMessage?.feedback;
      
      // If clicking the same feedback that's already set, toggle it off
      const newFeedback = currentFeedback === feedback ? null : feedback;
      
      await apiClient.patch(`/api/chat/conversations/${currentConversationId}/messages/${messageId}/feedback`, {
        feedback: newFeedback
      });
      
      // Update local state
      setMessages(prev => prev.map(msg => 
        msg.id === messageId ? { ...msg, feedback: newFeedback } : msg
      ));
    } catch (err) {
      console.error('Failed to update feedback:', err);
    }
  };

  // Track message count to detect new messages vs updates
  const prevMessageCountRef = useRef(0);

  // Auto-scroll to show last user message and start of bot response
  useEffect(() => {
    // Only scroll when new messages are added, not when existing messages are updated (like feedback)
    if (messages.length > prevMessageCountRef.current) {
      // When sending (waiting for response), scroll to the last user message
      // This allows the user to see their message and the start of the response
      if (lastUserMessageRef.current) {
        lastUserMessageRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        // Fallback to bottom if no user message ref
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }
    prevMessageCountRef.current = messages.length;
  }, [messages, sending]);

  // Sync conversation ID with context for sidebar active state
  useEffect(() => {
    setContextConversationId(currentConversationId);
  }, [currentConversationId, setContextConversationId]);

  // Initialize AI Foundry session
  useEffect(() => {
    const initializeSession = async () => {
      try {
        setLoading(true);
        setError(null);

        // Request AI Foundry session from backend
        const response = await apiClient.post<AIFoundrySession>('/api/ai-foundry/token');
        const sessionData = response.data;

        setSession(sessionData);
        
        // Only set welcome message if we don't have any messages yet
        if (messages.length === 0) {
          const welcomeMessage: Message = {
            id: 'welcome',
            text: sessionData.welcomeMessage || `Hello! I'm your AI assistant. How can I help you today?`,
            sender: 'bot',
            timestamp: new Date(),
          };
          setMessages([welcomeMessage]);
        }
        
        setLoading(false);
      } catch (err: any) {
        console.error('Failed to initialize AI Foundry session:', err);
        
        if (err.response?.status === 503) {
          setError('Azure AI Foundry is not configured. Please contact your administrator.');
        } else if (err.response?.status === 502) {
          setError('Unable to connect to Azure AI Foundry service. Please try again later.');
        } else {
          setError('Failed to initialize AI agent session. Please try again.');
        }
        
        setLoading(false);
      }
    };

    // Only initialize session once when component mounts
    if (!session) {
      initializeSession();
    }
  }, [session]);



  // Handle conversation selection from sidebar navigation
  useEffect(() => {
    const navigationState = location.state as { conversationId?: string; newConversation?: boolean } | null;
    
    if (navigationState?.conversationId && navigationState.conversationId !== currentConversationId) {
      // Load the conversation directly by ID instead of searching local array
      processedNewConversationRef.current = false; // Reset flag for conversation loads
      loadConversationById(navigationState.conversationId);
    } else if (navigationState?.newConversation && !processedNewConversationRef.current) {
      // Handle new conversation request by resetting state
      processedNewConversationRef.current = true; // Mark as processed
      resetToNewConversation();
    }
  }, [location.state]); // Only depend on location.state changes

  // Periodic sync to ensure data integrity (sync every 30 seconds)
  useEffect(() => {
    if (!currentConversationId || messages.length <= 1) return;

    const syncInterval = setInterval(() => {
      syncMessagesWithHistory();
    }, 30000); // 30 seconds

    return () => clearInterval(syncInterval);
  }, [currentConversationId, messages.length]);

  // Handle Adaptive Card actions (like button clicks)
  const handleAdaptiveCardAction = async (actionType: string, actionData: any) => {
    console.log('🔘 Adaptive Card Action Triggered:', { 
      actionType, 
      actionData, 
      session: session ? 'exists' : 'missing', 
      sessionId: session?.conversationId,
      currentConversationId, 
      sending 
    });
    
    if (!session) {
      console.log('❌ Action blocked - Missing session:', { 
        hasSession: !!session
      });
      
      // Show user-friendly message
      alert('Cannot process action: Chat session not properly initialized. Please refresh and try again.');
      return;
    }

    // Ensure we have a conversation for the action (similar to sendMessage logic)
    let conversationId = currentConversationId;
    
    if (!conversationId) {
      console.log('🆕 Creating new conversation for Adaptive Card action');
      try {
        const newConversationResponse = await apiClient.post('/api/chat/conversations', {
          title: `Card Action: ${actionType || 'Unknown'}`,
          agent_id: session?.agentId
        });
        conversationId = newConversationResponse.data.id;
        setCurrentConversationId(conversationId);
        
        // Refresh sidebar conversation list
        refreshConversations?.();
        
        console.log('✅ Created new conversation for card action:', conversationId);
      } catch (err: any) {
        console.error('❌ Failed to create conversation for card action:', err);
        alert('Failed to create conversation for this action. Please try again.');
        return;
      }
    }
    
    if (sending) {
      console.log('⏳ Action blocked - Already sending message');
      alert('Please wait for the current action to complete.');
      return;
    }
    
    try {
      setSending(true);
      console.log('✅ Processing action:', actionType);
      
      if (actionType === 'Action.Submit') {
        console.log('✅ Processing Action.Submit with data:', actionData);
        
        // Create a user message showing the action taken
        const actionMessage: Message = {
          id: Date.now().toString(),
          text: `User selected: ${actionData.action || 'Unknown Action'}`,
          sender: 'user',
          timestamp: new Date(),
        };
        
        setMessages(prev => [...prev, actionMessage]);
        
        console.log('🚀 Sending card response to backend...');
        
        try {
          // Send card response to AI Foundry
          const response = await apiClient.post('/api/ai-foundry/send-card-response', {
            conversationId: session.conversationId,
            userId: session.userId,
            actionData: actionData,
            activityType: 'invokeResponse'
          });

          console.log('🔄 Also saving to local conversation:', conversationId);
          
          console.log('✅ Backend response received:', response.data);

          if (response.data.response || response.data.attachments) {
            const botResponse: Message = {
              id: (Date.now() + 1).toString(),
              text: response.data.response || response.data.text || '',
              sender: 'bot',
              timestamp: new Date(),
              attachments: response.data.attachments || [],
            };
            
            setMessages(prev => [...prev, botResponse]);
            
            // Save both messages
            if (conversationId) {
              console.log(`Saving action message to conversation: ${conversationId}`);
              await saveMessageWithRetry(conversationId, actionMessage);
              console.log(`Saving bot response to conversation: ${conversationId}`);
              await saveMessageWithRetry(conversationId, botResponse);
              console.log(`Successfully saved both messages to conversation: ${conversationId}`);
            } else {
              console.warn('No conversation ID for saving action messages');
            }
          }
        } catch (backendError: any) {
          console.error('❌ Backend call failed:', backendError);
          
          // Add fallback response if backend fails
          const fallbackResponse: Message = {
            id: (Date.now() + 2).toString(),
            text: `I received your selection "${actionData.action || 'Unknown'}" but couldn't process it fully due to a connection issue. Please try again.`,
            sender: 'bot',
            timestamp: new Date(),
          };
          
          setMessages(prev => [...prev, fallbackResponse]);
          
          // Save the action message even if backend fails
          if (conversationId) {
            try {
              await saveMessageWithRetry(conversationId, actionMessage);
              await saveMessageWithRetry(conversationId, fallbackResponse);
            } catch (saveError) {
              console.error('❌ Failed to save messages after backend error:', saveError);
            }
          }
        }
      }
    } catch (error: any) {
      console.error('Error handling adaptive card action:', error);
      // Show error message to user
      const errorMessage: Message = {
        id: Date.now().toString(),
        text: `Error submitting card data: ${error?.message ?? 'Unknown error'}`,
        sender: 'bot',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setSending(false);
    }
  };

  const sendMessage = async (messageText?: string) => {
    try {
      const textToSend = messageText || inputText.trim();
      if (!textToSend || sending || !session) return;

    // Ensure we have a conversation for message persistence
    let conversationId = currentConversationId;
    
    // Create a new conversation only if we don't have one
    if (!conversationId || forceNewConversationRef.current) {
      try {
        if (forceNewConversationRef.current) {
          forceNewConversationRef.current = false;
        }
        
        // Only generate AI title for brand new conversations (no existing title)
        // Resumed conversations already have currentConversationTitle set
        const isBrandNewChat = !currentConversationTitle;
        let conversationTitle = currentConversationTitle || textToSend.substring(0, 50);
        
        if (isBrandNewChat) {
          try {
            const titleResponse = await apiClient.post('/api/ai-foundry/generate-title', {
              message: textToSend
            });
            if (titleResponse.data?.title) {
              conversationTitle = titleResponse.data.title;
            }
          } catch {
            // Use fallback title (already set above)
          }
          setCurrentConversationTitle(conversationTitle);
        }
        
        const newConversationResponse = await apiClient.post('/api/chat/conversations', {
          title: conversationTitle,
          agent_id: session?.agentId
        });
        conversationId = newConversationResponse.data.id;
        setCurrentConversationId(conversationId);
        processedNewConversationRef.current = false;
        refreshConversations?.();
      } catch (err: any) {
        console.error('Failed to create conversation:', err);
        conversationId = null;
      }
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      text: textToSend,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setSending(true);
    setShowQuestions(false); // Hide questions after first message
    setActiveSuggestions([]); // Clear current suggestions when user sends a message

    // Save user message immediately to prevent data loss
    if (conversationId) {
      try {
        // Wait for user message to be saved before proceeding
        console.log(`Attempting to save user message to conversation: ${conversationId}`);
        await saveMessageWithRetry(conversationId, userMessage);
        console.log(`Successfully saved user message to conversation: ${conversationId}`);
      } catch (error) {
        console.error(`Failed to save user message to conversation ${conversationId}:`, error);
        // Continue anyway - don't block the chat flow
      }
    } else {
      console.warn('No conversation ID available for saving user message');
    }

    try {
      // Send message to AI Foundry via backend
      const response = await apiClient.post('/api/ai-foundry/send-message', {
        conversationId: session.conversationId,
        userId: session.userId,
        text: textToSend,
      });

      const botResponseText = response.data.response || response.data.text || 'I received your message.';
      
      // Use backend-generated suggestions if available, otherwise fallback to frontend logic
      const followUpQuestions = response.data.suggestedQuestions?.length > 0 
        ? response.data.suggestedQuestions 
        : generateFollowUpQuestions(botResponseText, textToSend);

      const botResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: botResponseText,
        sender: 'bot',
        timestamp: new Date(),
        attachments: response.data.attachments || [],
        suggestedQuestions: followUpQuestions,
      };
      
      setMessages(prev => [...prev, botResponse]);
      setActiveSuggestions(followUpQuestions); // Set active suggestions for display
      
      // Save bot response immediately
      if (conversationId) {
        // Save bot response in background - don't await to avoid blocking UI
        saveMessageWithRetry(conversationId, botResponse);
      }
      
      setSending(false);

    } catch (err: any) {
      console.error('Failed to send message:', err);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: 'Sorry, I encountered an error processing your message. Please try again.',
        sender: 'bot',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
      
      // Save error response to history (user message was already saved above)
      if (conversationId) {
        // Don't await - save in background to avoid blocking UI
        saveMessageWithRetry(conversationId, errorMessage);
      }
      
      setSending(false);
    }
    } catch (globalError) {
      console.error('Critical error in sendMessage:', globalError);
      
      // Show error message to user
      const errorMessage: Message = {
        id: Date.now().toString(),
        text: 'Sorry, there was an error processing your message. Please try again.',
        sender: 'bot',
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, errorMessage]);
      setSending(false);
      setError('Failed to send message. Please try again.');
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  const handleQuestionSelect = (question: string) => {
    setActiveSuggestions([]); // Clear suggestions when one is selected
    sendMessage(question);
  };

  // Generate contextual follow-up questions based on bot response
  const generateFollowUpQuestions = (botMessage: string, userMessage: string): string[] => {
    const lowerBotMsg = botMessage.toLowerCase();
    const lowerUserMsg = userMessage.toLowerCase();
    
    // Context-aware questions based on keywords
    const questions: string[] = [];
    
    // Metrics-related follow-ups
    if (lowerBotMsg.includes('call') || lowerBotMsg.includes('volume') || lowerUserMsg.includes('metric')) {
      questions.push('What is the average call duration?');
      questions.push('Show me the call trend for this month');
    }
    
    // Agent performance follow-ups
    if (lowerBotMsg.includes('agent') || lowerBotMsg.includes('performance') || lowerUserMsg.includes('agent')) {
      questions.push('Who are the top performing agents?');
      questions.push('What is the average customer satisfaction score?');
    }
    
    // Customer satisfaction follow-ups
    if (lowerBotMsg.includes('satisfaction') || lowerBotMsg.includes('csat') || lowerBotMsg.includes('rating')) {
      questions.push('What are common customer complaints?');
      questions.push('Show me satisfaction trends');
    }
    
    // General analytical follow-ups
    if (lowerBotMsg.includes('trend') || lowerBotMsg.includes('increase') || lowerBotMsg.includes('decrease')) {
      questions.push('Can you break this down by time period?');
      questions.push('What factors contributed to this change?');
    }
    
    // Default follow-ups if no specific context
    if (questions.length === 0) {
      questions.push('Tell me more about this');
      questions.push('What else should I know?');
      questions.push('Can you provide more details?');
    }
    
    // Always add a way to explore more
    if (questions.length < 5) {
      questions.push('Show me related insights');
    }
    
    // Return 3-5 questions
    return questions.slice(0, Math.min(5, questions.length));
  };

  // Chat History Functions


  // Robust message saving with retry logic - returns the server-assigned message ID
  const saveMessageWithRetry = async (conversationId: string, message: Message, maxRetries = 3): Promise<string | null> => {
    // Prepare payload outside try block for error logging
    const transformedAttachments = (message.attachments || []).map(attachment => {
      // For url_citation attachments (e.g., from Fabric Data Agent), keep structure as-is
      if (attachment.contentType === 'url_citation') {
        return {
          kind: 'url_citation',
          contentType: attachment.contentType,
          url: attachment.url,
          title: attachment.title,
          name: attachment.name,
          text: attachment.text
        };
      }
      
      // For file_citation attachments, keep structure as-is
      if (attachment.contentType === 'file_citation') {
        return {
          kind: 'file_citation',
          contentType: attachment.contentType,
          fileId: attachment.fileId,
          quote: attachment.quote,
          name: attachment.name,
          text: attachment.text
        };
      }
      
      // For annotation attachments, keep structure as-is (already has content object)
      if (attachment.contentType === 'annotation') {
        return {
          kind: 'annotation',
          contentType: attachment.contentType,
          content: attachment.content,
          name: attachment.name
        };
      }
      
      // For adaptive cards and other attachments, use the legacy format
      return {
        kind: attachment.contentType?.includes('card') ? 'document' : 'file',
        uri: `data:${attachment.contentType};base64,${btoa(JSON.stringify(attachment.content || {}))}`,
        mime: attachment.contentType,
        title: attachment.name
      };
    });

    const payload = {
      id: message.id,
      text: message.text,
      content: message.text,
      sender: message.sender,
      role: message.sender === 'user' ? 'user' : 'assistant',
      timestamp: message.timestamp.toISOString(),
      createdAt: message.timestamp.toISOString(),
      sessionId: conversationId,
      type: "message",
      attachments: transformedAttachments
    };
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await apiClient.post<{ success: boolean; message: string; messageId: string }>(`/api/chat/conversations/${conversationId}/messages`, payload);
        console.log(`Message saved successfully. Status: ${response.status}, Server ID: ${response.data.messageId}`);
        
        // Update the message's ID with the server-assigned ID
        const serverMessageId = response.data.messageId;
        if (serverMessageId && serverMessageId !== message.id) {
          setMessages(prev => prev.map(m => 
            m.id === message.id ? { ...m, id: serverMessageId } : m
          ));
        }
        
        return serverMessageId;
      } catch (error: any) {
        console.error(`Attempt ${attempt}/${maxRetries} failed to save message to conversation ${conversationId}:`, {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          detail: error.response?.data?.detail,  // Pydantic validation errors
          message: error.message,
          payload: payload  // Log the payload that failed
        });
        
        if (attempt === maxRetries) {
          // Store failed message for later retry
          console.error('Failed to save message after all retries:', error);
          return null;
        }
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
    return null;
  };

  // Sync local messages with Cosmos DB (optional - for data integrity)
  const syncMessagesWithHistory = async () => {
    if (!currentConversationId || sending) return; // Don't sync while sending
    
    // Skip sync if we only have the welcome message (new conversation)
    if (messages.length <= 1 && messages[0]?.id === 'welcome') {

      return;
    }

    try {
      const response = await apiClient.get<Message[]>(`/api/chat/conversations/${currentConversationId}/messages`);
      const serverMessages = response.data;
      
      // Validate server response
      if (!Array.isArray(serverMessages)) {

        return;
      }
      
      // Validate each message has required fields (cast to any for flexibility)
      const validMessages = serverMessages.filter((msg: any) => 
        msg && 
        (msg.id || msg.text || msg.content) && 
        (msg.sender || msg.role)
      );
      
      // Only sync if server has more messages than local (never replace with fewer)
      if (validMessages.length > messages.length) {
        // Convert server messages to safe format before setting
        const safeMessages = validMessages.map((msg: any) => ({
          id: msg.id || `sync-${Date.now()}-${Math.random()}`,
          text: msg.text || msg.content || '',
          sender: (msg.sender || (msg.role === 'user' ? 'user' : 'bot')) as 'user' | 'bot',
          timestamp: msg.timestamp ? new Date(msg.timestamp) : 
                    msg.createdAt ? new Date(msg.createdAt) : 
                    new Date(),
          feedback: msg.feedback || null,
        }));
        
        setMessages(safeMessages);
      }
    } catch (error) {
      // Sync errors are not critical for user experience
    }
  };

  const handleNewConversation = () => {
    // Reset the processed flag to allow the new conversation request
    processedNewConversationRef.current = false;
    // Use the same navigation approach as the left menu
    navigate('/ai-foundry', { state: { newConversation: true }, replace: true });
  };

  const resetToNewConversation = () => {
    // Force new conversation creation on next message
    forceNewConversationRef.current = true;
    
    // Reset all chat state for a fresh start
    setCurrentConversationId(null);
    setCurrentConversationTitle(null);
    setShowQuestions(true);
    setActiveSuggestions([]); // Clear suggestions from previous conversation
    setError(null);
    
    // Re-show welcome message if we have a session
    if (session) {
      const welcomeMessage: Message = {
        id: 'welcome',
        text: session.welcomeMessage || `Hello! I'm your AI assistant. How can I help you today?`,
        sender: 'bot',
        timestamp: new Date(),
      };
      setMessages([welcomeMessage]);
    } else {
      // If no session, just clear messages
      setMessages([]);
    }
  };





  const loadConversationById = async (conversationId: string) => {
    try {
      setLoading(true);
      setError(null);
      setActiveSuggestions([]); // Clear suggestions from previous conversation
      
      // Load the full conversation directly by ID
      const response = await apiClient.get(`/api/chat/conversations/${conversationId}`);
      const fullConversation = response.data;

      
      // Convert messages to our Message format with safe conversion
      const convertedMessages: Message[] = fullConversation.messages?.map((msg: any) => {
        try {
          return {
            id: msg.id || `msg-${Date.now()}-${Math.random()}`,
            text: msg.text || msg.content || '',
            sender: msg.sender || (msg.role === 'user' ? 'user' : 'bot'),
            timestamp: msg.timestamp ? new Date(msg.timestamp) : 
                      msg.createdAt ? new Date(msg.createdAt) : 
                      new Date(),
            attachments: msg.attachments || [],
            feedback: msg.feedback || null,
          };
        } catch (error) {
          console.error('❌ Failed to convert message:', msg, error);
          return {
            id: `error-msg-${Date.now()}`,
            text: '[Message conversion error]',
            sender: 'bot' as const,
            timestamp: new Date(),
            attachments: [],
          };
        }
      }) || [];
      
      // Set the conversation data
      setMessages(convertedMessages);
      setCurrentConversationId(conversationId);
      setCurrentConversationTitle(fullConversation.title || 'Untitled Conversation');
      setShowQuestions(false); // Don't show questions for resumed conversations
      
      // Create session with existing conversation ID - use the stored AI Foundry conversation ID
      if (fullConversation.session_data) {
        setSession({
          conversationId: fullConversation.session_data.conversationId, // Use stored AI Foundry thread ID
          userId: fullConversation.session_data.userId,
          userName: fullConversation.session_data.userName,
          projectName: fullConversation.session_data.projectName,
          agentId: fullConversation.session_data.agentId,
          expiresIn: 3600,
          sessionCreated: true,
          welcomeMessage: fullConversation.session_data.welcomeMessage || '',
        });
      } else {
        // If no session data found, create a fresh AI Foundry session for this conversation
        console.warn('No session data found for conversation, creating fresh session');
        try {
          const sessionResponse = await apiClient.post<AIFoundrySession>('/api/ai-foundry/token');
          const sessionData = sessionResponse.data;
          setSession(sessionData);
        } catch (sessionError) {
          console.error('Failed to create fresh session:', sessionError);
          setError('Failed to create session for this conversation');
          setLoading(false);
          return;
        }
      }
      
      setLoading(false);
    } catch (error: any) {
      console.error('Failed to load conversation:', error);
      setError(`Failed to load conversation: ${error.response?.data?.detail || error.message}`);
      setLoading(false);
    }
  };


  const aiFoundryTab = getTabConfig(uiConfig, 'ai-foundry');
  const predefinedQuestions = aiFoundryTab?.predefinedQuestions || [];


  return (
    <Box sx={{ p: 3, height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Box>
          <Typography variant="h4" fontWeight={600}>
            {currentConversationTitle || aiFoundryTab?.labels.title || 'AI Foundry Chat'}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          onClick={handleNewConversation}
          size="small"
        >
          New Chat
        </Button>
      </Box>
      
      <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
        {aiFoundryTab?.labels.subtitle || 'Chat with our Azure AI Foundry assistant to get insights about call center performance, agent metrics, and more.'}
      </Typography>

      <Paper 
        sx={{ 
          flexGrow: 1, 
          display: 'flex', 
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
          mb: 2,
        }}
      >
        {loading && (
          <Box 
            sx={{ 
              display: 'flex', 
              flexDirection: 'column',
              alignItems: 'center', 
              justifyContent: 'center',
              height: '100%',
              gap: 2
            }}
          >
            <CircularProgress />
            <Typography variant="body2" color="text.secondary">
              Connecting to Azure AI Foundry...
            </Typography>
          </Box>
        )}

        {error && (
          <Box sx={{ p: 3 }}>
            <Alert severity="error">
              {error}
            </Alert>
          </Box>
        )}

        {!loading && !error && session && (
          <>
            {/* Messages List */}
            <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
              <MessageListErrorBoundary>
                <List>
                {messages.map((message, index) => {
                  // Safe message rendering with error handling
                  try {
                    if (!message || !message.id) {

                      return null;
                    }

                    // Check if this is the last user message
                    const isLastUserMessage = message.sender === 'user' && 
                      !messages.slice(index + 1).some(m => m.sender === 'user');
                    
                    // Skip welcome message for hover actions
                    const isWelcomeMessage = message.id === 'welcome';
                    const showHoverActions = hoveredMessageId === message.id && !isWelcomeMessage;

                    return (
                      <ListItem
                        key={message.id}
                        data-message-id={message.id}
                        ref={isLastUserMessage ? lastUserMessageRef : null}
                        onMouseEnter={() => setHoveredMessageId(message.id)}
                        onMouseLeave={() => setHoveredMessageId(null)}
                        sx={{
                          flexDirection: 'column',
                          alignItems: message.sender === 'user' ? 'flex-end' : 'flex-start',
                          px: 0,
                        }}
                      >
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 1,
                        maxWidth: '70%',
                        flexDirection: message.sender === 'user' ? 'row-reverse' : 'row',
                      }}
                    >
                      <Avatar
                        sx={{
                          bgcolor: message.sender === 'user' ? theme.palette.primary.main : theme.palette.secondary.main,
                          width: 32,
                          height: 32,
                        }}
                      >
                        {message.sender === 'user' ? <PersonIcon /> : <BotIcon />}
                      </Avatar>
                      
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: message.sender === 'user' ? 'flex-end' : 'flex-start' }}>
                        <Paper
                          sx={{
                            p: 2,
                            bgcolor: message.sender === 'user' 
                              ? theme.palette.primary.main 
                              : theme.palette.grey[100],
                            color: message.sender === 'user' 
                              ? theme.palette.primary.contrastText 
                              : theme.palette.text.primary,
                          }}
                        >
                          <Box className="message-content" sx={{ wordBreak: 'break-word' }}>
                            {/* Render text content if available */}
                            {message.text && (
                              <MarkdownMessage 
                                text={message.text} 
                                isUser={message.sender === 'user'}
                              />
                            )}
                            
                            {/* Render Adaptive Cards if available */}
                            {message.attachments?.map((attachment, attachIdx) => {
                              if (attachment.contentType === 'application/vnd.microsoft.card.adaptive') {
                                return (
                                  <Box key={attachIdx} sx={{ mt: message.text ? 1 : 0 }}>
                                    <AdaptiveCardRenderer
                                      card={attachment.content}
                                      onAction={handleAdaptiveCardAction}
                                    />
                                  </Box>
                                );
                              }
                              return null;
                            })}
                            
                            {/* Render URL Citations (e.g., from Fabric Data Agent) */}
                            {message.attachments?.some(a => a.contentType === 'url_citation') && (
                              <Box sx={{ 
                                mt: 1.5, 
                                pt: 1, 
                                borderTop: '1px solid',
                                borderColor: 'divider'
                              }}>
                                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
                                  Sources:
                                </Typography>
                                {message.attachments
                                  .filter(a => a.contentType === 'url_citation')
                                  .map((citation, citIdx) => (
                                    <Box 
                                      key={citIdx}
                                      component="a"
                                      href={citation.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      sx={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 0.5,
                                        mr: 1,
                                        mb: 0.5,
                                        px: 1,
                                        py: 0.5,
                                        borderRadius: 1,
                                        bgcolor: 'action.hover',
                                        color: 'primary.main',
                                        textDecoration: 'none',
                                        fontSize: '0.75rem',
                                        '&:hover': {
                                          bgcolor: 'action.selected',
                                          textDecoration: 'underline'
                                        }
                                      }}
                                    >
                                      <span>🔗</span>
                                      {citation.title || citation.name || 'Source'}
                                    </Box>
                                  ))}
                              </Box>
                            )}
                          </Box>
                          <Typography variant="caption" sx={{ opacity: 0.7, mt: 1, display: 'block' }}>
                            {formatMessageTimestamp(message.timestamp)}
                          </Typography>
                        </Paper>
                        
                        {/* Hover action buttons */}
                        <Box
                          sx={{
                            display: 'flex',
                            gap: 0.5,
                            mt: 0.5,
                            opacity: showHoverActions ? 1 : 0,
                            transition: 'opacity 0.2s',
                            visibility: showHoverActions ? 'visible' : 'hidden',
                          }}
                        >
                          {message.sender === 'user' ? (
                            // User message actions: Copy, Edit
                            <>
                              <Tooltip title="Copy message">
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCopyMessage(message.text, message.id);
                                  }}
                                  sx={{ 
                                    color: 'text.secondary',
                                    '&:hover': { color: 'primary.main' }
                                  }}
                                >
                                  <CopyIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Edit and resend">
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditMessage(message.text);
                                  }}
                                  sx={{ 
                                    color: 'text.secondary',
                                    '&:hover': { color: 'primary.main' }
                                  }}
                                >
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </>
                          ) : (
                            // Bot message actions: Copy, Thumbs Up, Thumbs Down
                            <>
                              <Tooltip title="Copy message">
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCopyMessage(message.text, message.id);
                                  }}
                                  sx={{ 
                                    color: 'text.secondary',
                                    '&:hover': { color: 'primary.main' }
                                  }}
                                >
                                  <CopyIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="I like this response">
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleMessageFeedback(message.id, 'positive');
                                  }}
                                  sx={{ 
                                    color: message.feedback === 'positive' ? 'success.main' : 'text.secondary',
                                    '&:hover': { color: 'success.main' }
                                  }}
                                >
                                  {message.feedback === 'positive' ? (
                                    <ThumbUpIcon fontSize="small" />
                                  ) : (
                                    <ThumbUpOutlinedIcon fontSize="small" />
                                  )}
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="I don't like this response">
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleMessageFeedback(message.id, 'negative');
                                  }}
                                  sx={{ 
                                    color: message.feedback === 'negative' ? 'error.main' : 'text.secondary',
                                    '&:hover': { color: 'error.main' }
                                  }}
                                >
                                  {message.feedback === 'negative' ? (
                                    <ThumbDownIcon fontSize="small" />
                                  ) : (
                                    <ThumbDownOutlinedIcon fontSize="small" />
                                  )}
                                </IconButton>
                              </Tooltip>
                            </>
                          )}
                        </Box>
                      </Box>
                    </Box>
                  </ListItem>
                    );
                  } catch (error) {
                    console.error('❌ Error rendering message:', message, error);
                    // Return a safe fallback message item
                    return (
                      <ListItem key={message?.id || 'error-msg'}>
                        <Paper sx={{ p: 2, bgcolor: 'error.light', color: 'error.contrastText' }}>
                          <Typography variant="body2">Error rendering message</Typography>
                        </Paper>
                      </ListItem>
                    );
                  }
                })}
                
                {sending && (
                  <ListItem sx={{ flexDirection: 'column', alignItems: 'flex-start', px: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Avatar sx={{ bgcolor: theme.palette.secondary.main, width: 32, height: 32 }}>
                        <BotIcon />
                      </Avatar>
                      <Paper sx={{ p: 2, bgcolor: theme.palette.grey[100] }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <CircularProgress size={16} />
                          <Typography variant="body2" color="text.secondary">
                            AI is thinking...
                          </Typography>
                        </Box>
                      </Paper>
                    </Box>
                  </ListItem>
                )}
                
                {/* Follow-up Suggestions - part of scrollable chat */}
                {activeSuggestions.length > 0 && (
                  <ListItem sx={{ flexDirection: 'column', alignItems: 'flex-end', px: 0, pb: 2 }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, maxWidth: '70%', alignItems: 'flex-end' }}>
                      {activeSuggestions.map((question, index) => (
                        <Chip
                          key={index}
                          label={question}
                          onClick={() => !sending && handleQuestionSelect(question)}
                          disabled={sending}
                          sx={{
                            cursor: 'pointer',
                            backgroundColor: 'background.paper',
                            color: 'text.primary',
                            border: 1,
                            borderColor: theme.palette.primary.main,
                            '&:hover': { 
                              backgroundColor: theme.palette.primary.main,
                              color: theme.palette.primary.contrastText,
                            },
                            '&.Mui-disabled': {
                              opacity: 0.6,
                            },
                            fontSize: '0.875rem',
                            height: 'auto',
                            padding: '8px 12px',
                            width: 'fit-content',
                            maxWidth: '100%',
                            '& .MuiChip-label': { 
                              whiteSpace: 'normal',
                              textAlign: 'right',
                            },
                          }}
                          clickable
                        />
                      ))}
                    </Box>
                  </ListItem>
                )}
                
                {/* Invisible element to scroll to */}
                <div ref={messagesEndRef} />
              </List>
              </MessageListErrorBoundary>
            </Box>

            {/* Quick Questions - positioned above message input */}
            {(messages.length <= 1 || showQuestions) && (
              <Box sx={{ px: 2, pb: 1 }}>
                <QuestionCards
                  questions={predefinedQuestions}
                  onQuestionSelect={handleQuestionSelect}
                  disabled={sending}
                />
              </Box>
            )}

            {/* Message Input */}
            <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
              <Stack direction="row" spacing={1} alignItems="center">
                {messages.length > 1 && (
                  <Tooltip title={showQuestions ? "Hide quick questions" : "Show quick questions"}>
                    <IconButton
                      onClick={() => setShowQuestions(!showQuestions)}
                      disabled={sending}
                      sx={{ 
                        color: showQuestions ? 'primary.main' : 'action.active',
                      }}
                    >
                      <QuestionIcon />
                    </IconButton>
                  </Tooltip>
                )}
                <TextField
                  fullWidth
                  multiline
                  maxRows={3}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask me about call center metrics, agent performance, or anything else..."
                  disabled={sending}
                />
                <Button
                  variant="contained"
                  onClick={() => sendMessage()}
                  disabled={!inputText.trim() || sending}
                  sx={{ 
                    minWidth: 60, 
                    height: '56px',
                    alignSelf: 'flex-end' 
                  }}
                >
                  <SendIcon />
                </Button>
              </Stack>
            </Box>
          </>
        )}
      </Paper>

      {/* AI Disclaimer */}
      <Alert severity="info" sx={{ mb: 1 }}>
        <Typography variant="caption">
           Powered by Azure AI Foundry • This AI assistant may generate inaccurate information. Please validate critical outputs.
        </Typography>
      </Alert>

    </Box>
  );
}
