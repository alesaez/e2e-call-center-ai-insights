# Copilot Studio Chatbot Integration - Implementation Guide

## Overview
This document describes the implementation of Microsoft Copilot Studio chatbot integration into the Call Center AI Insights application using the **microsoft-agents-copilotstudio-client** library with **On-Behalf-Of (OBO)** authentication flow. This approach provides user impersonation, eliminating the need for admin consent.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       React Frontend                             │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  ChatbotPage Component                                      │ │
│  │  - Material-UI styled chat interface                       │ │
│  │  - Auto-scroll to latest message                           │ │
│  │  - Clickable links (target="_blank")                       │ │
│  │  - Theme-aware colors                                      │ │
│  └──────────────────┬─────────────────────────────────────────┘ │
│                     │                                            │
│                     │ 1. Create session                          │
│                     ▼                                            │
└────────────────────────────────────────────────────────────────┘
                      │
                      │ POST /api/copilot-studio/session
                      │ Authorization: Bearer <User JWT>
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FastAPI Backend                               │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  POST /api/copilot-studio/session                          │ │
│  │  1. Validates user JWT                                     │ │
│  │  2. Uses MSAL acquire_token_on_behalf_of                  │ │
│  │  3. Exchanges user token for Power Platform token         │ │
│  │  4. Creates CopilotClient session                         │ │
│  │  5. Returns session_id, token_id, connector_url           │ │
│  └──────────────────┬─────────────────────────────────────────┘ │
│                     │                                            │
└─────────────────────┼────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│            Microsoft Entra ID (Token Exchange)                   │
│  On-Behalf-Of (OBO) Flow:                                       │
│  - Receives user's access token                                 │
│  - Validates token                                               │
│  - Issues new token for Power Platform API                      │
│  - Preserves user identity and permissions                      │
└──────────────────────┬──────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                 Power Platform / Copilot Studio                  │
│  - Receives session creation request with user token            │
│  - Creates conversation session                                 │
│  - Returns session details                                       │
│  - Processes messages as the authenticated user                 │
└─────────────────────────────────────────────────────────────────┘
                      │
                      │ Session created
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    React Frontend                                │
│  - Stores session_id, token_id, connector_url                   │
│  - Ready to send messages                                        │
│                                                                  │
│                     │ 2. Send message                            │
│                     ▼                                            │
│         POST /api/copilot-studio/send-message                   │
│         { session_id, token_id, connector_url, message }        │
└────────────────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FastAPI Backend                               │
│  POST /api/copilot-studio/send-message                          │
│  1. Validates user JWT                                           │
│  2. Gets Power Platform token via OBO                           │
│  3. Creates CopilotClient with session details                  │
│  4. Sends message to agent                                       │
│  5. Streams back bot responses                                   │
└──────────────────────┬──────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                 Power Platform / Copilot Studio                  │
│  - Receives message from authenticated user                      │
│  - Processes message through agent                              │
│  - Returns bot responses (Activity objects)                     │
│  - Maintains conversation context                               │
└─────────────────────────────────────────────────────────────────┘
```

## Prerequisites

### 1. Copilot Studio Agent Setup
- Published Copilot Studio agent in Power Platform
- Agent deployed to an environment
- Agent schema name (e.g., `crb64_myAgent`)
- Power Platform environment ID

### 2. Azure App Registration
- Use the **same app registration** as your backend API
- Delegated API permission: **`https://api.powerplatform.com/.default`**
- Client secret generated (for On-Behalf-Of flow)
- **No admin consent required** - uses delegated permissions

### 3. Get Copilot Studio Configuration

1. Go to [Microsoft Copilot Studio](https://copilotstudio.microsoft.com/)
2. Open your agent
3. Navigate to **Settings** → **Agent details**
4. Note the **Schema name** (e.g., `crb64_myAgent`)
5. Get the **Environment ID** from the Power Platform admin center or URL

## Implementation Details

### Backend Configuration

#### 1. Environment Variables (`backend/.env`)

```env
# Copilot Studio Configuration
COPILOT_STUDIO_DIRECT_CONNECT_URL=
COPILOT_STUDIO_ENVIRONMENT_ID=your-environment-id-here
COPILOT_STUDIO_SCHEMA_NAME=crb64_myAgent
COPILOT_STUDIO_TENANT_ID=your-tenant-id-here
COPILOT_STUDIO_APP_CLIENT_ID=your-backend-client-id-here
COPILOT_STUDIO_APP_CLIENT_SECRET=your-client-secret-value-here
```

**Important Notes:**
- Use the **same client ID** as your backend API (`ENTRA_CLIENT_ID`)
- Generate a **client secret** in your app registration (Certificates & secrets)
- Use the **secret value**, not the secret ID
- The tenant ID is usually the same as `ENTRA_TENANT_ID`

#### 2. Configuration Model (`backend/config.py`)

```python
class CopilotStudioSettings(BaseSettings):
    """Copilot Studio agent configuration settings."""
    model_config = ConfigDict(
        env_prefix="COPILOT_STUDIO_",
        case_sensitive=False,
        extra="ignore"  # Ignore extra environment variables
    )
    
    direct_connect_url: Optional[str] = ""
    environment_id: str
    schema_name: str
    tenant_id: str
    app_client_id: str
    app_client_secret: Optional[str] = ""
```

#### 3. Copilot Studio Endpoints (`backend/main.py`)

**Session Creation:**
```python
@app.post("/api/copilot-studio/session")
async def create_copilot_studio_session(
    token_payload: Dict = Depends(verify_token),
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """
    Create a new Copilot Studio session using On-Behalf-Of flow.
    - Validates user JWT
    - Exchanges token for Power Platform token
    - Creates session with user impersonation
    - Returns session_id, token_id, connector_url
    """
```

**Send Message:**
```python
@app.post("/api/copilot-studio/send-message")
async def send_message_to_copilot(
    request: SendMessageRequest,
    token_payload: Dict = Depends(verify_token),
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """
    Send a message to Copilot Studio and stream back responses.
    - Validates user JWT
    - Uses existing session details
    - Sends message as authenticated user
    - Returns bot responses
    """
```

**Key Features:**
- ✅ **On-Behalf-Of authentication** - User impersonation without admin consent
- ✅ **User context preserved** - Bot sees actual user identity
- ✅ **Delegated permissions** - Uses user's Power Platform permissions
- ✅ **Error handling** - Graceful handling of service unavailability
- ✅ **Activity parsing** - Properly handles Pydantic Activity models
- ✅ **Logging** - Tracks session creation and message sending

### Frontend Implementation

#### 1. Package Dependencies (`frontend/package.json`)

```json
{
  "dependencies": {
    "@mui/material": "^6.1.9",
    "@mui/icons-material": "^6.1.9",
    "axios": "^1.7.9"
  }
}
```

**Note:** Custom chat UI using Material-UI instead of Bot Framework Web Chat

#### 2. ChatbotPage Component (`frontend/src/components/ChatbotPage.tsx`)

**Key Features:**
- **Session management** - Creates session on mount using `/api/copilot-studio/session`
- **Custom chat UI** - Material-UI components (Paper, TextField, IconButton)
- **Auto-scroll** - Automatically scrolls to latest message using `useRef` and `scrollIntoView`
- **Clickable links** - URL detection with regex, renders as `<Link target="_blank">`
- **Theme integration** - Theme-aware message bubbles and colors
- **Error handling** - User-friendly error messages with troubleshooting
- **Loading states** - Shows progress during initialization and message sending
- **Responsive design** - Full-height chat interface with proper spacing

**Message Rendering:**
```typescript
const renderMessageText = (text: string) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  
  return parts.map((part, index) => {
    if (part.match(urlRegex)) {
      return (
        <Link
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
        >
          {part}
        </Link>
      );
    }
    return part;
  });
};
```

**Auto-scroll Implementation:**
```typescript
const messagesEndRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
}, [messages, sending]);
```



## Usage Guide

### For End Users

#### Starting a Chat Session

1. Navigate to **CS Chatbot** tab
2. Wait for session initialization (~ 2-3 seconds)
3. Start chatting with the AI assistant
4. Messages auto-scroll to bottom
5. URLs in responses are clickable and open in new tabs

### For Administrators

#### Setting Up Copilot Studio Integration

1. **In Copilot Studio:**
   - Publish your agent
   - Enable Web Channel Security
   - Generate Direct Line secret

2. **In Azure Portal (App Registration):**
   - Add **Delegated** API permission: `https://api.powerplatform.com/.default`
   - Generate client secret in **Certificates & secrets**
   - Copy the secret **Value** (not ID)

3. **In Backend (.env):**
   ```bash
   COPILOT_STUDIO_ENVIRONMENT_ID=your-environment-id
   COPILOT_STUDIO_SCHEMA_NAME=crb64_myAgent
   COPILOT_STUDIO_TENANT_ID=your-tenant-id
   COPILOT_STUDIO_APP_CLIENT_ID=your-backend-client-id
   COPILOT_STUDIO_APP_CLIENT_SECRET=your-client-secret-value
   ```

4. **Restart backend:**
   ```bash
   cd backend
   .\venv\Scripts\activate
   python main.py
   ```

5. **Test the integration:**
   - Login to the application
   - Navigate to **CS Chatbot** tab
   - Verify session creates successfully
   - Send a test message
   - Verify bot responds

## Troubleshooting

### Common Issues

#### 1. "Copilot Studio is not configured"

**Cause:** Required `COPILOT_STUDIO_*` environment variables not set in backend `.env`

**Solution:**
```bash
# Add to backend/.env (all required)
COPILOT_STUDIO_ENVIRONMENT_ID=your-environment-id
COPILOT_STUDIO_SCHEMA_NAME=crb64_myAgent
COPILOT_STUDIO_TENANT_ID=your-tenant-id
COPILOT_STUDIO_APP_CLIENT_ID=your-backend-client-id
COPILOT_STUDIO_APP_CLIENT_SECRET=your-client-secret-value
```

#### 2. "Failed to create session" or 403 Forbidden

**Possible Causes:**
- Missing Delegated permission: `https://api.powerplatform.com/.default`
- Client secret expired or incorrect
- Using Application permissions instead of Delegated
- User doesn't have access to the Copilot Studio agent

**Solutions:**
1. Add **Delegated** permission (not Application) in Azure Portal
2. Generate new client secret and use the **Value** (not ID)
3. Ensure On-Behalf-Of flow is working (check backend logs)
4. Verify user has access to the Power Platform environment
5. Check backend logs for detailed MSAL errors

#### 3. "Failed to initialize chatbot" or 401 Unauthorized

**Cause:** Backend endpoint not responding or JWT token invalid

**Solution:**
```bash
# Check backend is running
curl http://localhost:8000/health

# Verify you're logged in
# Check browser console for authentication errors
# Check that access token is being sent in Authorization header
```

#### 4. "Activity object has no attribute 'text'"

**Cause:** Incorrect Activity object handling (treating Pydantic model as dict)

**Solution:**
- Access Activity properties directly: `activity.text`, `activity.from_property.role`
- Do NOT use dictionary syntax: `activity['text']`
- The microsoft-agents library returns Pydantic models

#### 5. Messages not displaying or UI issues

**Possible Causes:**
- Session not created properly
- Response parsing errors
- Material-UI theme issues

**Solutions:**
- Check browser console for JavaScript errors
- Verify session_id, token_id, and connector_url are returned
- Check that messages array is updating correctly
- Clear browser cache and reload

### Debug Mode

#### Enable Backend Logging

```python
# In backend/main.py
logging.basicConfig(level=logging.DEBUG)
```

#### Check Browser Console

Press `F12` to open DevTools and look for:
- Token fetch requests
- WebSocket connection status
- Chat activity logs

## Security Considerations

### 1. Token Security
- ✅ **On-Behalf-Of flow** - User impersonation without admin consent
- ✅ **Short-lived tokens** - Power Platform tokens expire (typically 1 hour)
- ✅ **Server-side exchange** - Client secret never exposed to client
- ✅ **User authentication** - JWT required for all endpoints
- ✅ **Delegated permissions** - Uses user's own permissions, not app-only
- ✅ **HTTPS in production** - All communication encrypted

### 2. Data Privacy
- User conversations are handled by Microsoft services
- Bot sees actual user identity (not application identity)
- User's permissions determine what bot can access
- Ensure Copilot Studio compliance settings match your requirements
- Consider data residency requirements for your region

### 3. Access Control
- ✅ JWT authentication enforced on all endpoints
- ✅ User context preserved through OBO flow
- ✅ No admin consent required (uses Delegated permissions)
- ✅ Users can only access what they're authorized for
- ✅ Proper Activity object handling (Pydantic models)

## Performance Optimization

### 1. Token Caching
Currently, tokens are generated on each chat session. Consider implementing:
- Token reuse if not expired
- Refresh token logic
- Client-side token caching

### 2. Connection Pooling
For high-traffic scenarios:
- Implement connection pooling in backend
- Use async operations (already implemented)
- Monitor Direct Line API rate limits

### 3. Query Template Caching
- Templates loaded on-demand
- Consider caching frequently used templates
- Implement server-side caching for default templates

## Future Enhancements

### Phase 1: Enhanced Features
- [ ] Conversation history storage
- [ ] Save/export chat transcripts
- [ ] Template variable autocomplete
- [ ] Template usage analytics

### Phase 2: Advanced Integration
- [ ] Proactive suggestions based on dashboard data
- [ ] Context-aware responses (pass KPI data to bot)
- [ ] Multi-language support
- [ ] Voice input/output

### Phase 3: Team Collaboration
- [ ] Shared team templates
- [ ] Template versioning
- [ ] Template approval workflow
- [ ] Usage metrics per template

## API Reference

### POST /api/copilot-studio/session

Creates a new Copilot Studio chat session using On-Behalf-Of flow.

**Request:**
```http
POST /api/copilot-studio/session HTTP/1.1
Authorization: Bearer <USER_JWT_TOKEN>
Content-Type: application/json
```

**Response:**
```json
{
  "session_id": "abc123-def456-ghi789",
  "token_id": "token-xyz-890",
  "connector_url": "https://powerva.microsoft.com/...",
  "user_id": "user@example.com"
}
```

**Error Response (Configuration missing):**
```json
{
  "detail": "Copilot Studio is not configured. Please add COPILOT_STUDIO_* environment variables."
}
```

### POST /api/copilot-studio/send-message

Sends a message to the Copilot Studio agent and returns bot responses.

**Request:**
```http
POST /api/copilot-studio/send-message HTTP/1.1
Authorization: Bearer <USER_JWT_TOKEN>
Content-Type: application/json

{
  "session_id": "abc123-def456-ghi789",
  "token_id": "token-xyz-890",
  "connector_url": "https://powerva.microsoft.com/...",
  "message": "What is the call volume today?"
}
```

**Response:**
```json
{
  "responses": [
    {
      "text": "The call volume today is 1,245 calls.",
      "role": "bot"
    }
  ]
}
```

**Error Response (Authentication failed):**
```json
{
  "detail": "Failed to create Copilot Studio session: 403 Forbidden"
}
```

## Deployment to Azure Container Apps

### Backend Dockerfile Considerations
```dockerfile
# Ensure COPILOT_STUDIO_* env vars are available
ENV COPILOT_STUDIO_DIRECT_LINE_SECRET=""
ENV COPILOT_STUDIO_ENVIRONMENT_ID=""
# ... other vars
```

### Azure Container Apps Configuration
```yaml
properties:
  configuration:
    secrets:
      - name: copilot-studio-secret
        value: "your-direct-line-secret"
    env:
      - name: COPILOT_STUDIO_DIRECT_LINE_SECRET
        secretRef: copilot-studio-secret
      - name: COPILOT_STUDIO_ENVIRONMENT_ID
        value: "b770721c-e485-e866-bddd-e89fe5b9a701"
```

### Use Azure Key Vault (Recommended)
```yaml
# Reference Key Vault secret
env:
  - name: COPILOT_STUDIO_DIRECT_LINE_SECRET
    secretRef: copilot-studio-secret

secretsKeyVaultUrl: https://your-keyvault.vault.azure.net/secrets/DirectLineSecret
```

## Testing

### Manual Testing Checklist

- [ ] Backend health check responds
- [ ] JWT authentication works
- [ ] Copilot Studio session creation succeeds
- [ ] Chat UI loads without errors
- [ ] Can send/receive messages
- [ ] Auto-scroll works (scrolls to latest message)
- [ ] URLs are clickable and open in new tabs
- [ ] Theme colors applied correctly
- [ ] Error handling displays properly
- [ ] Messages display bot responses correctly
- [ ] Session persists across multiple messages

### Integration Testing

```bash
# Test session creation
curl -X POST http://localhost:8000/api/copilot-studio/session \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Test send message (use session details from above)
curl -X POST http://localhost:8000/api/copilot-studio/send-message \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "your-session-id",
    "token_id": "your-token-id",
    "connector_url": "your-connector-url",
    "message": "Hello"
  }'
```

## Monitoring & Logging

### Key Metrics to Track
- Session creation success rate
- Session creation latency
- Message send/receive latency
- Chat session duration
- Message throughput
- Error rates (403, 401, 500)
- On-Behalf-Of token acquisition success rate

### Log Locations
- **Backend:** Console output or configured log file
- **Frontend:** Browser console (DevTools)
- **Azure:** Application Insights (when deployed)

### Sample Log Entries

```
INFO: ✓ Copilot Studio configured: environment_id=b770721c-..., schema_name=crb64_myAgent
INFO: Token validated successfully for user: user@example.com
INFO: Created Copilot Studio session for user: user@example.com
INFO: Sent message to Copilot Studio agent
ERROR: Failed to create session: 403 Forbidden - Check Delegated permissions
ERROR: Activity attribute error - Ensure using Pydantic property access
```

## Resources

- [Microsoft Copilot Studio Documentation](https://learn.microsoft.com/en-us/microsoft-copilot-studio/)
- [microsoft-agents-copilotstudio-client](https://pypi.org/project/microsoft-agents-copilotstudio-client/)
- [MSAL Python Documentation](https://msal-python.readthedocs.io/)
- [On-Behalf-Of Flow](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-on-behalf-of-flow)
- [Power Platform API](https://learn.microsoft.com/en-us/power-platform/admin/programmability-authentication-v2)
- [Azure Container Apps Documentation](https://learn.microsoft.com/en-us/azure/container-apps/)

---

**Implementation Status:** ✅ Complete
**Last Updated:** November 17, 2025
**Version:** 2.0.0 (On-Behalf-Of Flow with microsoft-agents library)
