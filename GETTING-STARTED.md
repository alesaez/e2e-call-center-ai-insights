# Getting Started Checklist

Follow this checklist to get your SSO-enabled application up and running.

## ☐ Prerequisites
- [ ] Azure subscription with permissions to create App Registrations
- [ ] Node.js 18+ installed
- [ ] Python 3.11+ installed
- [ ] Git installed
- [ ] Docker installed (for containerization)
- [ ] Azure CLI installed (for deployment)

## ☐ Azure Entra ID Setup

### Backend API App Registration
- [ ] Create new app registration named "CallCenterAI-Backend-API"
- [ ] Copy Application (client) ID → Save as `ENTRA_CLIENT_ID` for backend
- [ ] Copy Directory (tenant) ID → Save as `ENTRA_TENANT_ID`
- [ ] Go to "Expose an API"
- [ ] Set Application ID URI: `api://{backend-client-id}`
- [ ] Add scope: `access_as_user`
- [ ] Enable the scope

### Frontend SPA App Registration
- [ ] Create new app registration named "CallCenterAI-Frontend"
- [ ] Select "Single-page application (SPA)" platform
- [ ] Add redirect URI: `http://localhost:3000`
- [ ] Copy Application (client) ID → Save as `ENTRA_CLIENT_ID` for frontend
- [ ] Go to "API permissions"
- [ ] Add permission → My APIs → Select backend app
- [ ] Select `access_as_user` scope
- [ ] Grant admin consent (if you have permissions)
- [ ] Add logout URL: `http://localhost:3000`

## ☐ Local Development Setup

### Backend Configuration
- [ ] Navigate to `backend/` directory
- [ ] Copy `.env.example` to `.env`
- [ ] Edit `.env`:
  - [ ] Set `ENTRA_TENANT_ID`
  - [ ] Set `ENTRA_CLIENT_ID` (backend client ID)
  - [ ] Set `ALLOWED_ORIGINS=["http://localhost:3000","http://localhost:5173"]`
  - [ ] **Optional - For Chat History:** Set Cosmos DB variables (see below)
  - [ ] **Optional - For CS Chatbot:** Set `COPILOT_STUDIO_*` variables (see below)
- [ ] Create Python virtual environment: `python -m venv venv`
- [ ] Activate virtual environment:
  - Windows: `.\venv\Scripts\Activate.ps1`
  - Linux/Mac: `source venv/bin/activate`
- [ ] Install dependencies: `pip install -r requirements.txt`

### Frontend Configuration
- [ ] Navigate to `frontend/` directory
- [ ] Copy `.env.example` to `.env.local`
- [ ] Edit `.env.local`:
  - [ ] Set `VITE_ENTRA_CLIENT_ID` (frontend client ID)
  - [ ] Set `VITE_ENTRA_TENANT_ID`
  - [ ] Set `VITE_REDIRECT_URI=http://localhost:3000`
  - [ ] Set `VITE_POST_LOGOUT_REDIRECT_URI=http://localhost:3000`
  - [ ] Set `VITE_API_BASE_URL=http://localhost:8000`
  - [ ] Set `VITE_API_SCOPE=api://{backend-client-id}/access_as_user`
- [ ] Install dependencies: `npm install`

## ☐ Run Locally

### Option 1: Use Quick Start Script (Windows)
- [ ] Run: `.\start-dev.ps1`
- [ ] Wait for both services to start

### Option 2: Manual Start
- [ ] Terminal 1 - Start backend:
  ```bash
  cd backend
  .\venv\Scripts\Activate.ps1  # Windows
  python main.py
  ```
- [ ] Terminal 2 - Start frontend:
  ```bash
  cd frontend
  npm run dev
  ```

## ☐ Test Authentication
- [ ] Open browser to `http://localhost:3000`
- [ ] Verify login page loads
- [ ] Click "Sign in with Microsoft"
- [ ] Complete Microsoft authentication
- [ ] Verify redirect to dashboard
- [ ] Verify user information displays
- [ ] Verify "Sign Out" button works

## ☐ Test API Endpoints
- [ ] Health check works: `http://localhost:8000/health`
- [ ] Dashboard loads KPI data
- [ ] User profile endpoint returns data
- [ ] Check browser console for errors
- [ ] Check backend logs for issues

## ☐ Optional: Setup Chat History with Cosmos DB

### Prerequisites for Chat History
- [ ] Azure Cosmos DB account (SQL API)
- [ ] Database named `ContosoSuites`
- [ ] Two containers with specific partition keys:
  - `Sessions` container (partition key: `/userId`)
  - `Messages` container (partition key: `/sessionId`)

### Create Cosmos DB Resources
- [ ] Go to Azure Portal > Create Cosmos DB account (SQL API)
- [ ] Create database: `ContosoSuites`
- [ ] Create Sessions container:
  - Name: `Sessions`
  - Partition key: `/userId`
  - Throughput: 400 RU/s (autoscale recommended)
- [ ] Create Messages container:
  - Name: `Messages`
  - Partition key: `/sessionId`
  - Throughput: 400 RU/s (autoscale recommended)

### Configure Cosmos DB Access
- [ ] Login to Azure CLI: `az login`
- [ ] Assign "Cosmos DB Built-in Data Contributor" role to your user
- [ ] Set `COSMOS_DB_ACCOUNT_URI` in `.env`
- [ ] Note: Uses DefaultAzureCredential for localhost, ManagedIdentityCredential for Azure Container Apps

### Update Backend Configuration for Chat History
- [ ] Edit `backend/.env`:
  ```env
  # Cosmos DB Configuration for Chat History
  # Uses DefaultAzureCredential for localhost and ManagedIdentityCredential for Azure Container Apps
  COSMOS_DB_ACCOUNT_URI=https://your-account.documents.azure.com:443/
  COSMOS_DB_DATABASE_NAME=ContosoSuites
  COSMOS_DB_SESSIONS_CONTAINER=Sessions
  COSMOS_DB_MESSAGES_CONTAINER=Messages
  ```
- [ ] Restart backend server

### Test Chat History
- [ ] Login to the application
- [ ] Navigate to **Chatbot** page
- [ ] Verify "Chat History" and "New Chat" buttons appear
- [ ] Create a new conversation
- [ ] Send messages and verify they persist
- [ ] Refresh page and verify conversation loads
- [ ] Check backend logs for Cosmos DB connection success

### Benefits of Two-Container Architecture
- ✅ **Performance**: Optimized queries for sessions vs messages
- ✅ **Scalability**: Independent scaling per container
- ✅ **Cost Efficiency**: Reduced cross-partition queries
- ✅ **Future-Ready**: Supports vector search and advanced features

## ☐ Optional: Setup CS Chatbot Integration

### Prerequisites for CS Chatbot
- [ ] Published Copilot Studio agent in Power Platform
- [ ] Power Platform environment ID
- [ ] Agent schema name (e.g., `crb64_myAgent`)

### Configure App Registration for Copilot Studio
- [ ] Go to Azure Portal > App registrations > Your backend app
- [ ] Navigate to **API permissions**
- [ ] Click **Add a permission** > **APIs my organization uses**
- [ ] Search for `Power Platform API` or use: `https://api.powerplatform.com`
- [ ] Select **Delegated permissions** (NOT Application)
- [ ] Check `user_impersonation` permission
- [ ] Click **Add permissions**
- [ ] No admin consent required (Delegated permissions)

### Generate Client Secret
- [ ] In your backend app registration
- [ ] Go to **Certificates & secrets**
- [ ] Click **New client secret**
- [ ] Add description and set expiration
- [ ] Copy the **Value** (not the Secret ID)

### Update Backend Configuration for CS Chatbot
- [ ] Edit `backend/.env`:
  ```env
  COPILOT_STUDIO_ENVIRONMENT_ID=your-environment-id-here
  COPILOT_STUDIO_SCHEMA_NAME=crb64_myAgent
  COPILOT_STUDIO_TENANT_ID=your-tenant-id-here
  COPILOT_STUDIO_APP_CLIENT_ID=your-backend-client-id-here
  COPILOT_STUDIO_APP_CLIENT_SECRET=your-client-secret-value-here
  ```
- [ ] Restart backend server

### Test CS Chatbot
- [ ] Login to the application
- [ ] Navigate to **CS Chatbot** tab
- [ ] Verify "Initializing chat..." message
- [ ] Wait for session creation (~ 2-3 seconds)
- [ ] Verify chat interface loads
- [ ] Send a test message
- [ ] Verify bot responds
- [ ] Check that messages auto-scroll
- [ ] Verify URLs are clickable

## ☐ Azure Deployment (Optional)

### Prepare Azure Resources
- [ ] Login to Azure: `az login`
- [ ] Create resource group
- [ ] Create Container Registry
- [ ] Note ACR name for deployment

### Deploy Using Script
- [ ] Run deployment script:
  ```powershell
  .\deploy-azure.ps1 `
    -ResourceGroup "rg-callcenterai" `
    -Location "eastus" `
    -ContainerRegistry "yourregistry" `
    -EntraFrontendClientId "your-frontend-id" `
    -EntraBackendClientId "your-backend-id" `
    -EntraTenantId "your-tenant-id"
  ```
- [ ] Wait for deployment to complete
- [ ] Note frontend and backend URLs

### Update Entra ID for Production
- [ ] Go to frontend app registration
- [ ] Add production redirect URI: `https://your-frontend-url`
- [ ] Add production logout URL: `https://your-frontend-url`
- [ ] Save changes

### Test Production Deployment
- [ ] Visit production frontend URL
- [ ] Test login flow
- [ ] Verify dashboard loads
- [ ] Test API calls
- [ ] Check application logs in Azure Portal

## ☐ Post-Deployment

### Security Hardening
- [ ] Enable managed identities on Container Apps
- [ ] Move secrets to Azure Key Vault
- [ ] Review and restrict CORS origins
- [ ] Enable Application Insights
- [ ] Set up alerts and monitoring
- [ ] Review security recommendations

### Documentation
- [ ] Document your specific configuration
- [ ] Update team wiki with deployment process
- [ ] Share Entra ID app registration details with team
- [ ] Document any customizations made

## ☐ Common Issues Resolved
If you encounter issues, check these first:

- [ ] Redirect URI mismatch → Verify exact match in Entra ID
- [ ] CORS errors → Check `ALLOWED_ORIGINS` in backend
- [ ] Token validation fails → Verify client IDs and tenant ID
- [ ] Dependencies not installed → Run install commands
- [ ] Port conflicts → Change ports in configs

## 📚 Reference Documentation
- **Full Setup Guide**: See `SETUP-SSO.md`
- **Implementation Details**: See `IMPLEMENTATION-SUMMARY.md`
- **Project Overview**: See `README.md`
- **Troubleshooting**: See `SETUP-SSO.md` § Troubleshooting

## ✅ Success Criteria
Your implementation is successful when:
- ✅ User can sign in with Microsoft account
- ✅ Dashboard displays after authentication with KPIs and charts
- ✅ User profile data loads from backend API
- ✅ Sign out works correctly
- ✅ Token refresh happens automatically
- ✅ Protected endpoints require authentication
- ✅ Health check endpoint works
- ✅ **Optional:** CS Chatbot initializes and responds to messages

## 🎉 You're Done!
Once all items are checked, your SSO implementation is complete and ready for use!

**Need help?**
- SSO Setup: See `SETUP-SSO.md`
- CS Chatbot: See `COPILOT-STUDIO-INTEGRATION.md`
- General: See `README.md`
