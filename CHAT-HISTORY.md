# Chat History with Azure Cosmos DB

This application features a robust chat history system built on Azure Cosmos DB with a modern two-container architecture optimized for performance, scalability, and cost-effectiveness.

## 🏗️ Architecture Overview

### Two-Container Design

The chat history system uses **two separate containers** in Cosmos DB for optimal performance:

1. **Sessions Container** (Partitioned by `userId`)
   - Stores chat session metadata
   - Optimized for user-centric queries
   - Efficient conversation listing and management

2. **Messages Container** (Partitioned by `sessionId`)
   - Stores individual chat messages
   - Optimized for message retrieval within conversations
   - Supports rich message metadata

### Benefits of This Architecture

✅ **Performance**: Each container is optimized for its specific query patterns  
✅ **Scalability**: Proper partitioning prevents hot partitions and enables horizontal scaling  
✅ **Cost Efficiency**: Minimized cross-partition queries reduce RU consumption  
✅ **Flexibility**: Independent scaling and indexing strategies per container  
✅ **Future-Ready**: Supports advanced features like vector search and semantic caching  

## 📋 Container Schemas

### Sessions Container

**Partition Key**: `userId`

```json
{
  "id": "sess_0a2c...c9",
  "type": "session",
  "userId": "user_123",
  "tenantId": "contoso",
  "createdAt": "2025-11-19T17:15:00Z",
  "lastActiveAt": "2025-11-19T17:17:40Z",
  "title": "Finance assistant chat",
  "model": "gpt-4o-mini",
  "metadata": { 
    "channel": "web", 
    "appVersion": "1.8.2" 
  },
  
  // Legacy compatibility fields
  "conversation_id": "legacy-copilot-id",
  "user_name": "John Doe",
  "session_data": { /* Copilot Studio session info */ },
  "is_active": true
}
```

### Messages Container

**Partition Key**: `sessionId`

```json
{
  "id": "msg_8b4d...12",
  "type": "message",
  "sessionId": "sess_0a2c...c9",
  "role": "user",        // "assistant" | "tool"
  "content": "What is our Q3 EBITDA?",
  "tokens": 15,
  "createdAt": "2025-11-19T17:16:00Z",
  "attachments": [
    { 
      "kind": "file", 
      "uri": "https://.../Q3.pdf", 
      "mime": "application/pdf" 
    }
  ],
  "toolCalls": [
    {
      "id": "call_123",
      "name": "get_financial_data", 
      "arguments": {"period": "Q3"},
      "result": { /* tool result */ }
    }
  ],
  "vector": [0.012, -0.08, ...],     // Optional: embedding for semantic cache
  "grounding": {
    "sources": ["Fabric:Finance", "SharePoint:/sites/FP&A"],
    "citations": [{ "title": "Q3 Summary", "url": "..." }]
  },
  
  // Legacy compatibility fields
  "text": "What is our Q3 EBITDA?",
  "sender": "user",
  "timestamp": "2025-11-19T17:16:00Z"
}
```

## 🔧 Configuration

### Environment Variables

```bash
# Azure Cosmos DB Configuration
COSMOS_DB_ACCOUNT_URI=https://your-account.documents.azure.com:443/
COSMOS_DB_CONNECTION_STRING=AccountEndpoint=...;AccountKey=...;
COSMOS_DB_DATABASE_NAME=ContosoSuites
COSMOS_DB_SESSIONS_CONTAINER=Sessions
COSMOS_DB_MESSAGES_CONTAINER=Messages
```

### Authentication Options

#### 1. DefaultAzureCredential (Recommended for Development)
```bash
# Use your Azure CLI credentials
az login
# Set only the account URI
COSMOS_DB_ACCOUNT_URI=https://your-account.documents.azure.com:443/
```

#### 2. Connection String (Production)
```bash
# Use connection string for production deployment
COSMOS_DB_CONNECTION_STRING=AccountEndpoint=...;AccountKey=...;
```

## 🚀 API Endpoints

### Conversation Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/chat/conversations` | Get user's conversation list with summaries |
| `POST` | `/api/chat/conversations` | Create new conversation/session |
| `GET` | `/api/chat/conversations/{id}` | Get full conversation with all messages |
| `DELETE` | `/api/chat/conversations/{id}` | Soft delete conversation |

### Message Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/chat/conversations/{id}/messages` | Get all messages for a conversation |
| `POST` | `/api/chat/conversations/{id}/messages` | Add new message to conversation |

### Example API Usage

**Create New Conversation:**
```bash
POST /api/chat/conversations
{
  "title": "New Chat Session"
}
```

**Add Message:**
```bash
POST /api/chat/conversations/sess_abc123/messages
{
  "content": "Hello, how can I help?",
  "role": "user",
  "tokens": 10
}
```

## 💡 Key Features

### 🛡️ Error Resilience
- **Graceful Degradation**: Chat continues to work even if Cosmos DB is unavailable
- **Message Retry Logic**: Automatic retry with exponential backoff for failed saves
- **Error Boundaries**: React error boundaries prevent UI crashes
- **Safe Message Rendering**: Invalid messages show placeholders instead of crashing

### 🔄 Backward Compatibility
- **Legacy API Support**: All existing endpoints continue to work
- **Message Format Conversion**: Seamless conversion between old/new schemas
- **Migration Support**: Gradual migration from single-container to two-container architecture

### ⚡ Performance Optimizations
- **Efficient Partitioning**: Sessions by userId, Messages by sessionId
- **Optimized Queries**: Minimal cross-partition queries
- **Message Count Caching**: Fast conversation list loading
- **Lazy Loading**: Messages loaded on-demand per conversation

### 🔍 Advanced Features (Future-Ready)
- **Vector Search**: Message embeddings for semantic search capabilities
- **Tool Call Tracking**: Complete audit trail of AI tool usage
- **Attachment Support**: File and image attachments with proper metadata
- **Citation Tracking**: Source attribution for grounded AI responses

## 🧪 Testing

### Backend Testing

```python
# Test session creation
session = await cosmos_service.create_session(
    user_id='test-user-123',
    user_name='Test User',
    copilot_conversation_id='copilot-conv-456',
    title='Test Chat Session'
)

# Test message addition
success = await cosmos_service.add_message_to_session(
    session_id=session.id,
    user_id='test-user-123',
    content='Hello, world!',
    role='user'
)

# Test conversation retrieval
conversation = await cosmos_service.get_conversation(
    session_id=session.id,
    user_id='test-user-123'
)
```

### Frontend Testing

The frontend automatically handles:
- Message persistence during chat
- Conversation history loading
- Error recovery and retry logic
- Real-time message synchronization

## 🔧 Troubleshooting

### Common Issues

**1. Connection Errors**
```
Failed to initialize Cosmos DB: Unauthorized
```
- Check Azure credentials: `az login`
- Verify COSMOS_DB_ACCOUNT_URI is correct
- Ensure user has Cosmos DB Contributor role

**2. Message Not Saving**
```
❌ Failed to save message (attempt 3/3)
```
- Check network connectivity
- Verify conversation exists
- Review Cosmos DB RU consumption

**3. Conversation Loading Issues**
```
⚠️ Message count mismatch - syncing with server
```
- Normal during high-frequency messaging
- Messages will sync automatically
- Check browser console for detailed logs

### Debug Mode

Enable detailed logging:
```typescript
// In ChatbotPage.tsx, messages are logged with these prefixes:
// 📤 User message sending
// 📥 Server message sync
// ✅ Successful operations
// ❌ Error conditions
// ⚠️ Warning states
```

## 🚦 Production Considerations

### Cosmos DB Setup
1. **Create Cosmos DB Account** with SQL API
2. **Configure Networking** (private endpoints recommended)
3. **Set Throughput** (start with 400 RU/s autoscale)
4. **Enable Backup** (continuous backup recommended)
5. **Configure RBAC** (use managed identities)

### Monitoring
- Monitor RU consumption
- Track query performance
- Set up alerts for errors
- Review partition key distribution

### Security
- Use managed identities in production
- Enable firewall rules
- Implement private endpoints
- Regular access review

## 📚 Additional Resources

- [Azure Cosmos DB Documentation](https://docs.microsoft.com/azure/cosmos-db/)
- [Cosmos DB Best Practices](https://docs.microsoft.com/azure/cosmos-db/best-practices)
- [Partitioning Strategy Guide](https://docs.microsoft.com/azure/cosmos-db/partitioning-overview)
- [Azure Identity SDK](https://docs.microsoft.com/python/api/azure-identity/)