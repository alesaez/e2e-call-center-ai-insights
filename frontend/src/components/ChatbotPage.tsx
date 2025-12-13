import { useEffect, useState, useRef, Component, ErrorInfo, ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useConversationContext } from '../contexts/ConversationContext';
import { UIConfig } from '../services/featureConfig';
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
} from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import apiClient from '../services/apiClient';
import QuestionCards from './QuestionCards';
import ReferenceProcessor from './ReferenceProcessor';

import { predefinedQuestions } from '../config/chatQuestions';

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

interface CopilotStudioSession {
  conversationId: string;
  userId: string;
  userName: string;
  environmentId: string;
  schemaName: string;
  endpoint: string;
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
}

interface MessageAttachment {
  contentType: string;
  content?: any;
  name?: string;
}

// Markdown renderer component with custom styling
const MarkdownMessage = ({ text, isUser }: { text: string; isUser: boolean }) => {
  const theme = useTheme();
  
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
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

interface ChatbotPageProps {
  uiConfig: UIConfig;
}

export default function ChatbotPage({ uiConfig: _uiConfig }: ChatbotPageProps) {
  const theme = useTheme();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { refreshConversations, setCurrentConversationId: setContextConversationId } = useConversationContext();
  const forceNewConversationRef = useRef<boolean>(false); // Track if we should force a new conversation
  const processedNewConversationRef = useRef<boolean>(false); // Track if we've processed a new conversation request
  const [session, setSession] = useState<CopilotStudioSession | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showQuestions, setShowQuestions] = useState(true);
  
  // Chat history state (managed by sidebar now, but we still need conversations for navigation handling)


  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [currentConversationTitle, setCurrentConversationTitle] = useState<string | null>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  // Sync conversation ID with context for sidebar active state
  useEffect(() => {
    setContextConversationId(currentConversationId);
  }, [currentConversationId, setContextConversationId]);

  // Initialize Copilot Studio session
  useEffect(() => {
    const initializeSession = async () => {
      try {
        setLoading(true);
        setError(null);

        // Request Copilot Studio session from backend
        const response = await apiClient.post<CopilotStudioSession>('/api/copilot-studio/token');
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
        console.error('Failed to initialize Copilot Studio session:', err);
        
        if (err.response?.status === 503) {
          setError('Copilot Studio is not configured. Please contact your administrator.');
        } else if (err.response?.status === 502) {
          setError('Unable to connect to Copilot Studio service. Please try again later.');
        } else {
          setError('Failed to initialize chatbot session. Please try again.');
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
          agent_id: session?.schemaName
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
          // Send InvokeResponse activity to Copilot Studio (following Node.js pattern)
          const response = await apiClient.post('/api/copilot-studio/send-card-response', {
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
    
    if (!conversationId || forceNewConversationRef.current) {
      try {
        if (forceNewConversationRef.current) {
          forceNewConversationRef.current = false; // Reset the flag
        }
        const newConversationResponse = await apiClient.post('/api/chat/conversations', {
          title: textToSend.length > 50 ? textToSend.substring(0, 50) + '...' : textToSend,
          agent_id: session?.schemaName
        });
        conversationId = newConversationResponse.data.id;
        setCurrentConversationId(conversationId);
        
        // Reset the processed flag since we now have a real conversation
        processedNewConversationRef.current = false;
        
        // Refresh sidebar conversation list
        refreshConversations?.();
      } catch (err: any) {
        console.error('Failed to create conversation for message:', err);
        console.error('Error details:', err.response?.data || err.message);
        // Continue without persistence if conversation creation fails
        conversationId = null; // Ensure we don't use a stale ID
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
      // Send message to Copilot Studio via backend
      const response = await apiClient.post('/api/copilot-studio/send-message', {
        conversationId: session.conversationId,
        userId: session.userId,
        text: textToSend,
      });

      const botResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: response.data.response || response.data.text || 'I received your message.',
        sender: 'bot',
        timestamp: new Date(),
        attachments: response.data.attachments || [],
      };
      
      setMessages(prev => [...prev, botResponse]);
      
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
    sendMessage(question);
  };

  // Chat History Functions


  // Robust message saving with retry logic
  const saveMessageWithRetry = async (conversationId: string, message: Message, maxRetries = 3) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Transform attachments to match backend MessageAttachment model
        const transformedAttachments = (message.attachments || []).map(attachment => ({
          kind: attachment.contentType?.includes('card') ? 'document' : 'file',
          uri: `data:${attachment.contentType};base64,${btoa(JSON.stringify(attachment.content || {}))}`,
          mime: attachment.contentType,
          title: attachment.name
        }));

        // Send in the format expected by the backend ChatMessage model
        const payload = {
          id: message.id,
          text: message.text,           // Legacy field
          content: message.text,        // New field
          sender: message.sender,       // Legacy field
          role: message.sender === 'user' ? 'user' : 'assistant', // New field
          timestamp: message.timestamp.toISOString(), // Legacy field
          createdAt: message.timestamp.toISOString(), // New field
          sessionId: conversationId,    // New field (required for new schema)
          type: "message",              // New field
          attachments: transformedAttachments // Transform attachments for backend
        };
        
        const response = await apiClient.post(`/api/chat/conversations/${conversationId}/messages`, payload);
        console.log(`Message saved successfully. Status: ${response.status}`);
        return true;
      } catch (error: any) {
        console.error(`Attempt ${attempt}/${maxRetries} failed to save message to conversation ${conversationId}:`, {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          message: error.message
        });
        
        if (attempt === maxRetries) {
          // Store failed message for later retry
          console.error('Failed to save message after all retries:', error);
          return false;
        }
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
    return false;
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
                    new Date()
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
    navigate('/chatbot', { state: { newConversation: true }, replace: true });
  };

  const resetToNewConversation = () => {
    // Force new conversation creation on next message
    forceNewConversationRef.current = true;
    
    // Reset all chat state for a fresh start
    setCurrentConversationId(null);
    setCurrentConversationTitle(null);
    setShowQuestions(true);
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
      
      // Create session with existing conversation ID - use the stored Copilot Studio conversation ID
      if (fullConversation.session_data) {
        setSession({
          conversationId: fullConversation.session_data.conversationId, // Use stored Copilot Studio conversation ID
          userId: fullConversation.session_data.userId,
          userName: fullConversation.session_data.userName,
          environmentId: fullConversation.session_data.environmentId,
          schemaName: fullConversation.session_data.schemaName,
          endpoint: fullConversation.session_data.endpoint,
          expiresIn: 3600,
          sessionCreated: true,
          welcomeMessage: fullConversation.session_data.welcomeMessage || '',
        });
      } else {
        // If no session data found, create a fresh Copilot Studio session for this conversation
        console.warn('No session data found for conversation, creating fresh session');
        try {
          const sessionResponse = await apiClient.post<CopilotStudioSession>('/api/copilot-studio/token');
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





  return (
    <Box sx={{ p: 3, height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Box>
          <Typography variant="h4">
            {currentConversationTitle || 'Copilot Studio Chat'}
          </Typography>
          {currentConversationTitle && (
            <Typography variant="caption" color="text.secondary">
              Copilot Studio Chat
            </Typography>
          )}
        </Box>
        <Button
          variant="outlined"
          onClick={handleNewConversation}
          size="small"
        >
          New Chat
        </Button>
      </Box>
      
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Chat with our Copilot Studio AI assistant to get insights about call center performance, agent metrics, and more.
      </Typography>

      {session && (
        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          <Chip
            size="small"
            label={`Environment: ${session.environmentId.substring(0, 8)}...`}
            color="primary"
            variant="outlined"
          />
          {currentConversationId && messages.length > 1 && (
            <Chip
              size="small"
              label="Conversation Resumed"
              color="secondary"
              variant="outlined"
            />
          )}
          <Chip
            size="small"
            label={`Schema: ${session.schemaName}`}
            color="secondary"
            variant="outlined"
          />
        </Stack>
      )}

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
              Connecting to Copilot Studio...
            </Typography>
          </Box>
        )}

        {error && (
          <Box sx={{ p: 3 }}>
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
            <Typography variant="body2" color="text.secondary">
              <strong>Configuration Status:</strong>
            </Typography>
            <ul style={{ marginTop: '8px' }}>
              <li>Using Environment ID and Schema Name (Direct Connect)</li>
              <li>Backend endpoint: /api/copilot-studio/token</li>
            </ul>
          </Box>
        )}

        {!loading && !error && session && (
          <>
            {/* Messages List */}
            <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
              <MessageListErrorBoundary>
                <List>
                {messages.map((message) => {
                  // Safe message rendering with error handling
                  try {
                    if (!message || !message.id) {

                      return null;
                    }

                    return (
                      <ListItem
                        key={message.id}
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
                        <Box sx={{ wordBreak: 'break-word' }}>
                          {/* Render text content if available */}
                          {message.text && (
                            <MarkdownMessage 
                              text={message.text} 
                              isUser={message.sender === 'user'}
                            />
                          )}
                          
                          {/* Render Adaptive Cards if available */}
                          {message.attachments?.map((attachment, index) => {
                            if (attachment.contentType === 'application/vnd.microsoft.card.adaptive') {
                              return (
                                <Box key={index} sx={{ mt: message.text ? 1 : 0 }}>
                                  <AdaptiveCardRenderer
                                    card={attachment.content}
                                    onAction={handleAdaptiveCardAction}
                                  />
                                </Box>
                              );
                            }
                            return null;
                          })}
                        </Box>
                        <Typography variant="caption" sx={{ opacity: 0.7, mt: 1, display: 'block' }}>
                          {message.timestamp instanceof Date && !isNaN(message.timestamp.getTime()) 
                            ? message.timestamp.toLocaleTimeString() 
                            : 'Invalid time'}
                        </Typography>
                      </Paper>
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
              <Stack direction="row" spacing={1}>
                {messages.length > 1 && (
                  <Tooltip title={showQuestions ? "Hide quick questions" : "Show quick questions"}>
                    <IconButton
                      onClick={() => setShowQuestions(!showQuestions)}
                      disabled={sending}
                      sx={{ 
                        color: showQuestions ? 'primary.main' : 'action.active',
                        alignSelf: 'flex-end',
                        mb: 0.5,
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
                  sx={{ minWidth: 60 }}
                >
                  <SendIcon />
                </Button>
              </Stack>
            </Box>
          </>
        )}
      </Paper>

      <Typography variant="caption" color="text.secondary">
        Powered by Microsoft Copilot Studio • Environment ID: {session?.environmentId?.substring(0, 8)}...
      </Typography>


    </Box>
  );
}
