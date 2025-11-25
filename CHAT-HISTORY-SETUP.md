# Chat History Setup Guide - Two-Container Architecture

## Overview
This guide explains how to set up the **enhanced chat history feature** using Azure Cosmos DB with an **optimized two-container architecture** and DefaultAzureCredential for secure localhost development.

## 🚀 New Two-Container Architecture

### What Changed
- **Before:** Single `ChatHistory` container (limited scalability)
- **After:** Two specialized containers for optimal performance:
  - **Sessions** container (partitioned by `userId`)
  - **Messages** container (partitioned by `sessionId`)

### Why This Matters
- ✅ **Better Performance** - Each container optimized for specific query patterns
- ✅ **Cost Efficiency** - Reduced cross-partition queries save RUs
- ✅ **Scalability** - Independent scaling and throughput allocation
- ✅ **Future-Ready** - Supports vector search, semantic caching, and advanced features

## Features Implemented ✅
- ✅ **Optimized Two-Container Design** - Sessions + Messages for better performance
- ✅ **Persistent chat conversations** - All messages saved to Cosmos DB
- ✅ **User isolation** - Each user sees only their own conversations
- ✅ **Continue conversations** - Resume any previous chat session
- ✅ **Delete conversations** - Remove unwanted chat history
- ✅ **Real-time saving** - Messages auto-saved during chat
- ✅ **Error resilience** - React error boundaries prevent crashes
- ✅ **Secure authentication** - Uses DefaultAzureCredential for localhost
- ✅ **Legacy compatibility** - Seamless migration from old format

## Prerequisites

### 1. Azure Account & Cosmos DB
- Active Azure subscription
- Azure Cosmos DB account created
- Cosmos DB configured for SQL API

### 2. Local Development Setup
- Azure CLI installed and configured
- Python virtual environment in backend folder
- All backend dependencies installed

## Configuration Steps

### Step 1: Azure CLI Authentication
```powershell
# Login to Azure CLI (required for DefaultAzureCredential)
az login

# Verify you're logged in to the correct account
az account show

# List your subscriptions (if needed)
az account list --output table
```

### Step 2: Create Cosmos DB Account and Containers

1. **Create Cosmos DB Account** (if not exists):
   ```bash
   # Example Azure CLI command
   az cosmosdb create \
     --resource-group your-resource-group \
     --name your-cosmosdb-account \
     --kind GlobalDocumentDB \
     --default-consistency-level Session \
     --locations regionName=EastUS failoverPriority=0 isZoneRedundant=False
   ```

2. **Create Database**:
   ```bash
   az cosmosdb sql database create \
     --account-name your-cosmosdb-account \
     --resource-group your-resource-group \
     --name ContosoSuites \
     --throughput 400
   ```

3. **Create Sessions Container** (partitioned by userId):
   ```bash
   az cosmosdb sql container create \
     --account-name your-cosmosdb-account \
     --resource-group your-resource-group \
     --database-name ContosoSuites \
     --name Sessions \
     --partition-key-path "/userId"
   ```

4. **Create Messages Container** (partitioned by sessionId):
   ```bash
   az cosmosdb sql container create \
     --account-name your-cosmosdb-account \
     --resource-group your-resource-group \
     --database-name ContosoSuites \
     --name Messages \
     --partition-key-path "/sessionId"
   ```

5. **Get Account URI**:
   ```bash
   az cosmosdb show --name your-cosmosdb-account --resource-group your-resource-group --query documentEndpoint
   ```

### Step 3: Configure Backend Environment

Edit `backend/.env` file:

```bash
# Azure Cosmos DB Configuration - Two Container Architecture
# For localhost with DefaultAzureCredential (recommended for development)
COSMOS_DB_ACCOUNT_URI=https://your-cosmosdb-account.documents.azure.com:443/

# For production or when connection string is preferred
COSMOS_DB_CONNECTION_STRING=AccountEndpoint=https://your-account.documents.azure.com:443/;AccountKey=your-key-here;

# Database and container names - NEW TWO-CONTAINER SETUP
COSMOS_DB_DATABASE_NAME=ContosoSuites
COSMOS_DB_SESSIONS_CONTAINER=Sessions      # Partitioned by /userId
COSMOS_DB_MESSAGES_CONTAINER=Messages      # Partitioned by /sessionId

# Legacy container (for backward compatibility - optional)
COSMOS_DB_CHAT_CONTAINER=ChatHistory
```

### Container Partition Strategy

| Container | Partition Key | Purpose | Query Patterns |
|-----------|---------------|---------|----------------|
| **Sessions** | `/userId` | Chat session metadata | List user conversations, session management |
| **Messages** | `/sessionId` | Individual messages | Retrieve conversation messages, add new messages |

### Step 4: Cosmos DB Permissions

Grant your user account access to Cosmos DB:

```bash
# Get your user's object ID
az ad signed-in-user show --query id -o tsv

# Assign Cosmos DB Data Contributor role
az cosmosdb sql role assignment create \
  --account-name your-cosmosdb-account \
  --resource-group your-resource-group \
  --scope "/" \
  --principal-id your-user-object-id \
  --role-definition-name "Cosmos DB Built-in Data Contributor"
```

### Step 5: Firewall Configuration (if needed)

If you encounter firewall errors:

1. **Azure Portal Method**:
   - Go to Azure Portal → Your Cosmos DB account
   - Navigate to **Settings** → **Networking**
   - Under **Firewall and virtual networks**:
     - Select "Selected networks"
     - Check "Allow access from Azure portal"
     - Add your current IP address
     - Click **Save**

2. **Azure CLI Method**:
   ```bash
   # Get your current IP
   $myIp = (Invoke-RestMethod -Uri "https://api.ipify.org").Trim()
   
   # Add IP to firewall rules
   az cosmosdb network-rule add \
     --resource-group your-resource-group \
     --name your-cosmosdb-account \
     --ip-address $myIp
   ```

## Authentication Methods

### DefaultAzureCredential (Recommended for Localhost)
**Automatically used when:**
- Environment variable `ENVIRONMENT=development` is set, OR
- Azure App Service environment is NOT detected
- `COSMOS_DB_ACCOUNT_URI` is provided in .env

**Authentication flow:**
1. Environment variables (service principal)
2. Azure CLI credentials (`az login`)
3. Managed Identity (in Azure)
4. Visual Studio/VS Code credentials
5. Azure PowerShell credentials

### Connection String (Fallback/Production)
**Used when:**
- `COSMOS_DB_CONNECTION_STRING` is provided
- DefaultAzureCredential fails or is unavailable

## Testing the Setup

### 1. Start Backend Server
```powershell
cd backend
.\venv\Scripts\Activate.ps1
python -m uvicorn main:app --reload --port 8000
```

### 2. Check Logs
Look for successful initialization:
```
INFO:cosmos_service:Using DefaultAzureCredential for Cosmos DB authentication (localhost)
INFO:cosmos_service:Cosmos DB initialized: ContosoSuites with containers Sessions, Messages
INFO:cosmos_service:Sessions container ready (partition: /userId)
INFO:cosmos_service:Messages container ready (partition: /sessionId)
```

### 3. Test Chat History API

**Create a conversation:**
```bash
curl -X POST http://localhost:8000/api/chat/conversations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-jwt-token" \
  -d '{"title": "Test Conversation"}'
```

**List conversations:**
```bash
curl http://localhost:8000/api/chat/conversations \
  -H "Authorization: Bearer your-jwt-token"
```

### 4. Test Frontend Integration
1. Navigate to http://localhost:3000
2. Login with Microsoft account
3. Go to Chatbot page
4. Look for "Chat History" and "New Chat" buttons
5. Create a conversation and send messages
6. Verify messages persist after page refresh

## Troubleshooting

### Problem: "Forbidden" - IP blocked by firewall
**Solution:** Add your IP to Cosmos DB firewall (Step 5 above)

**Check:** 
```bash
# Verify your current IP
curl https://api.ipify.org
```

### Problem: "Unauthorized" - Authentication failed
**Solution:** 
1. Ensure `az login` is completed
2. Verify Cosmos DB role assignment (Step 4 above)
3. Check account URI is correct

**Check:**
```bash
# Verify Azure CLI login
az account show

# Test Cosmos DB access
az cosmosdb database list --name your-cosmosdb-account --resource-group your-resource-group
```

### Problem: DefaultAzureCredential not working
**Solution:** Use connection string method
1. Get connection string from Azure Portal
2. Set `COSMOS_DB_CONNECTION_STRING` in .env
3. Restart backend server

**Check:**
```bash
# Get connection string
az cosmosdb keys list --name your-cosmosdb-account --resource-group your-resource-group --type connection-strings
```

### Problem: Database/Container not created
**Check:** Backend logs for initialization errors
**Solution:** Ensure your user has "Cosmos DB Built-in Data Contributor" role

### Problem: Chat history not saving
**Check:** 
1. Network tab for API call errors
2. Backend logs for Cosmos DB errors
3. Browser console for frontend errors

## Development vs Production

### Development (Localhost)
- ✅ **DefaultAzureCredential** (secure, no secrets in code)
- ✅ **Auto-detection** of localhost environment
- ✅ **Azure CLI** authentication
- ⚠️ **Firewall** may need IP configuration

### Production (Azure App Service)
- ✅ **Managed Identity** (preferred)
- ✅ **Connection String** (with Key Vault)
- ✅ **Environment variables** for configuration
- ✅ **No firewall issues** (Azure internal traffic)

## File Structure

```
backend/
├── .env                     # Updated with two-container configuration
├── requirements.txt         # azure-identity & azure-cosmos dependencies
├── config.py               # New container settings
├── cosmos_service.py       # Completely rewritten for two-container architecture
├── chat_models.py          # New models: ChatSession & ChatMessage
└── main.py                 # Enhanced API endpoints

frontend/src/components/
├── ChatbotPage.tsx         # Enhanced with error boundaries and safe rendering
└── ChatHistoryDrawer.tsx   # Conversation list sidebar

docs/
├── CHAT-HISTORY.md         # Comprehensive technical documentation
└── CHAT-HISTORY-SETUP.md   # This setup guide
```

## 📊 Architecture Benefits

### Query Performance Improvements

**Before (Single Container):**
```sql
-- Cross-partition query for user conversations (expensive)
SELECT * FROM c WHERE c.user_id = "user123" AND c.type = "conversation"

-- Cross-partition query for messages (expensive)  
SELECT * FROM c WHERE c.conversation_id = "conv456" AND c.type = "message"
```

**After (Two Containers):**
```sql
-- Sessions container: Efficient single-partition query
SELECT * FROM Sessions s WHERE s.userId = "user123"

-- Messages container: Efficient single-partition query
SELECT * FROM Messages m WHERE m.sessionId = "sess456"
```

### Cost & Performance Benefits
- **50-80% RU reduction** for typical query patterns
- **Faster response times** due to single-partition queries
- **Better scaling** - containers scale independently
- **Optimized indexing** per container's query patterns

## Security Benefits

### DefaultAzureCredential Advantages
- ✅ **No secrets in code** - Uses Azure identity
- ✅ **Automatic token refresh** - Handles expiration
- ✅ **Multiple auth methods** - Falls back gracefully
- ✅ **Azure best practice** - Recommended by Microsoft
- ✅ **Works locally & cloud** - Same code everywhere

### Additional Security
- ✅ **JWT token validation** - All API calls authenticated
- ✅ **User isolation** - Partition key = user_id
- ✅ **Firewall protection** - IP restrictions available
- ✅ **Role-based access** - Cosmos DB RBAC

## Next Steps

1. **Customize UI** - Modify ChatHistoryDrawer styling
2. **Add search** - Implement conversation search functionality
3. **Export data** - Add conversation export feature
4. **Monitor usage** - Set up Cosmos DB monitoring
5. **Optimize performance** - Configure RU/s and indexing

## Support Resources

- [Azure Cosmos DB Documentation](https://docs.microsoft.com/azure/cosmos-db/)
- [DefaultAzureCredential Guide](https://docs.microsoft.com/python/api/azure-identity/azure.identity.defaultazurecredential)
- [Azure CLI Reference](https://docs.microsoft.com/cli/azure/cosmosdb)
- [Cosmos DB Security](https://docs.microsoft.com/azure/cosmos-db/security-baseline)

---

**Estimated Setup Time:** 10-15 minutes  
**Difficulty:** Intermediate  
**Prerequisites:** Azure subscription, Azure CLI access