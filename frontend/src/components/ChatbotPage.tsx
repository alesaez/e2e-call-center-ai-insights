import { useEffect, useState, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  Alert,
  CircularProgress,
  TextField,
  Button,
  List,
  ListItem,
  Avatar,
  Chip,
  Stack,
  Link,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Send as SendIcon,
  SmartToy as BotIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import apiClient from '../services/apiClient';

interface CopilotStudioSession {
  conversationId: string;
  userId: string;
  userName: string;
  environmentId: string;
  schemaName: string;
  endpoint: string;
  expiresIn: number;
  sessionCreated: boolean;
}

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
}

// Markdown renderer component with custom styling
const MarkdownMessage = ({ text, isUser }: { text: string; isUser: boolean }) => {
  const theme = useTheme();
  
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // Custom link styling
        a: ({ ...props }) => (
          <Link
            href={props.href}
            target="_blank"
            rel="noopener noreferrer"
            sx={{
              color: isUser ? 'inherit' : theme.palette.primary.main,
              textDecoration: 'underline',
              '&:hover': {
                opacity: 0.8,
              },
            }}
          >
            {props.children}
          </Link>
        ),
        // Custom paragraph styling
        p: ({ ...props }) => (
          <Box
            sx={{
              display: 'block',
              mb: 1,
              '&:last-child': { mb: 0 },
            }}
          >
            <Typography variant="body2" component="span">
              {props.children}
            </Typography>
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

export default function ChatbotPage() {
  const theme = useTheme();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [session, setSession] = useState<CopilotStudioSession | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

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
        
        // Add welcome message
        const welcomeMessage: Message = {
          id: 'welcome',
          text: `Hello! I'm your AI assistant. I can help you with call center insights, agent performance, and more. What would you like to know?`,
          sender: 'bot',
          timestamp: new Date(),
        };
        setMessages([welcomeMessage]);
        
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

    initializeSession();
  }, []);

  const sendMessage = async () => {
    if (!inputText.trim() || sending || !session) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText.trim(),
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setSending(true);

    try {
      // Send message to Copilot Studio via backend
      const response = await apiClient.post('/api/copilot-studio/send-message', {
        conversationId: session.conversationId,
        userId: session.userId,
        text: userMessage.text,
      });

      const botResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: response.data.response || 'I received your message.',
        sender: 'bot',
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, botResponse]);
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
      setSending(false);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  return (
    <Box sx={{ p: 3, height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column' }}>
      <Typography variant="h4" gutterBottom>
        Copilot Studio Chat
      </Typography>
      
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
              <li>Environment ID: b770721c-e485-e866-bddd-e89fe5b9a701</li>
              <li>Schema Name: crb64_myAgent</li>
              <li>Backend endpoint: /api/copilot-studio/token</li>
            </ul>
          </Box>
        )}

        {!loading && !error && session && (
          <>
            {/* Messages List */}
            <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
              <List>
                {messages.map((message) => (
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
                          <MarkdownMessage 
                            text={message.text} 
                            isUser={message.sender === 'user'}
                          />
                        </Box>
                        <Typography variant="caption" sx={{ opacity: 0.7, mt: 1, display: 'block' }}>
                          {message.timestamp.toLocaleTimeString()}
                        </Typography>
                      </Paper>
                    </Box>
                  </ListItem>
                ))}
                
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
            </Box>

            {/* Message Input */}
            <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
              <Stack direction="row" spacing={1}>
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
                  onClick={sendMessage}
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
