# SSO Authentication Setup Guide

This guide walks you through implementing Single Sign-On (SSO) authentication using Microsoft Entra ID (formerly Azure AD) for the Call Center AI Insights application.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Azure Entra ID Setup](#azure-entra-id-setup)
3. [Local Development Setup](#local-development-setup)
4. [Azure Container Apps Deployment](#azure-container-apps-deployment)
5. [Security Considerations](#security-considerations)
6. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- Azure subscription with permissions to create App Registrations
- Node.js 18+ and npm
- Python 3.11+
- Docker (for containerization)
- Azure CLI (for deployment)

---

## Azure Entra ID Setup

### 1. Register the Backend API Application

1. Navigate to [Azure Portal](https://portal.azure.com) > **Microsoft Entra ID** > **App registrations**
2. Click **New registration**
3. Fill in the details:
   - **Name**: `CallCenterAI-Backend-API`
   - **Supported account types**: Choose based on your organization needs
   - **Redirect URI**: Leave blank for now
   - **Redirect URI**: 
     - Platform: **Web**
     - URL: `http://localhost:8000` (for local dev)
4. Click **Register**
5. Note down the **Application (client) ID** and **Directory (tenant) ID**

6. **Expose an API**:
   - Go to **Expose an API** > **Add a scope**
   - Set Application ID URI: `api://{backend-client-id}` (use the client ID from step 5)
   - Add a scope:
     - **Scope name**: `access_as_user`
     - **Who can consent**: Admins and users
     - **Admin consent display name**: Access CallCenterAI API
     - **Admin consent description**: Allows the app to access the API as the user
     - **State**: Enabled
7. **API Permissions**:
   - Go to **API permissions** > **Add a permission**
   - Choose the following permissions:
      - From Microsoft APIs:
         - **Microsoft Graph** (Delegated): openid, profile and User.Read
      - From **API's my organization uses**
         - **Power Platform API** (Delegated): CopilotStudio.Copilots.Invoke
         - **Azure Machine Learning Services** (Delegated): user_impersonation
8. **Web and SPA Settings**
   - Under **Authentication** > **Settings**
   - Enable *Access tokens* and *ID tokens*


### 2. Register the Frontend Application

1. Go to **App registrations** > **New registration**
2. Fill in the details:
   - **Name**: `CallCenterAI-Frontend`
   - **Supported account types**: Same as backend
   - **Redirect URI**: 
     - Platform: **Single-page application (SPA)**
     - URL: `http://localhost:3000` (for local dev)
3. Click **Register**
4. Note down the **Application (client) ID**

5. **Configure Authentication**:
   - Go to **Authentication**
   - Under **Single-page application** redirect URIs, add:
     - `http://localhost:3000` (local dev)
     - Your production URL when deployed (e.g., `https://your-app.azurecontainerapps.io`)
   - Under **Implicit grant and hybrid flows**, ensure nothing is checked (using modern auth code flow)
   - **Logout URL**: `http://localhost:3000` (and production URL)

6. **API Permissions**:
   - Go to **API permissions** > **Add a permission**
   - Choose the following permissions:
      - From Microsoft APIs:
         - **Microsoft Graph** (Delegated): openid, profile and User.Read
      - From **My APIs** > Select your backend API
         - Select the `access_as_user` scope
         - Click **Add permissions**
         - Click **Grant admin consent** (if you have admin rights)

7. **Optional - For CS Chatbot Integration**:
   - Go to **API permissions** > **Add a permission**
   - Choose **APIs my organization uses**
   - Search for **Power Platform API** or use: `https://api.powerplatform.com`
   - Select **Delegated permissions** (NOT Application permissions)
   - Check `user_impersonation` permission
   - Click **Add permissions**
   - **No admin consent required** for Delegated permissions with On-Behalf-Of flow

### 3. Configure Token Configuration (Optional)

For additional claims in tokens:
1. Go to **Token configuration** in your backend app
2. Add optional claims as needed (e.g., `email`, `preferred_username`)

---

## Local Development Setup

### Backend Setup

1. **Navigate to backend directory**:
   ```bash
   cd backend
   ```

2. **Create virtual environment**:
   ```bash
   python -m venv venv
   
   # Windows
   .\venv\Scripts\activate
   
   # Linux/Mac
   source venv/bin/activate
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Create `.env` file**:
   ```bash
   cp .env.example .env
   ```

4. **Edit `.env` with your values**:
   ```env
   ENTRA_TENANT_ID=your-tenant-id
   ENTRA_CLIENT_ID=your-backend-client-id
   ALLOWED_ORIGINS=["http://localhost:3000", "http://localhost:5173"]
   
   # Optional - For CS Chatbot (see COPILOT-STUDIO-INTEGRATION.md)
   # COPILOT_STUDIO_ENVIRONMENT_ID=your-environment-id
   # COPILOT_STUDIO_SCHEMA_NAME=crb64_myAgent
   # COPILOT_STUDIO_TENANT_ID=your-tenant-id
   # COPILOT_STUDIO_APP_CLIENT_ID=your-backend-client-id
   # COPILOT_STUDIO_APP_CLIENT_SECRET=your-client-secret
   ```

6. **Run the backend**:
   ```bash
   python main.py
   ```
   
   Backend will be available at: `http://localhost:8000`

### Frontend Setup

1. **Navigate to frontend directory**:
   ```bash
   cd frontend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Create `.env.local` file**:
   ```bash
   cp .env.example .env.local
   ```

4. **Edit `.env.local` with your values**:
   ```env
   VITE_ENTRA_CLIENT_ID=your-frontend-client-id
   VITE_ENTRA_TENANT_ID=your-tenant-id
   VITE_REDIRECT_URI=http://localhost:3000
   VITE_POST_LOGOUT_REDIRECT_URI=http://localhost:3000
   VITE_API_BASE_URL=http://localhost:8000
   VITE_API_SCOPE=api://your-backend-client-id/access_as_user
   ```

5. **Run the frontend**:
   ```bash
   npm run dev
   ```
   
   Frontend will be available at: `http://localhost:3000`

### Test Authentication

1. Open browser to `http://localhost:3000`
2. Click "Sign in with Microsoft"
3. Complete Microsoft authentication
4. You should be redirected to the dashboard
5. Verify that the dashboard shows your user information

---

## Azure Container Apps Deployment

### 1. Build and Push Docker Images

**Backend:**
```bash
cd backend

# Build image
docker build -t callcenterai-backend:latest .

# Tag for Azure Container Registry (replace with your ACR)
docker tag callcenterai-backend:latest youracr.azurecr.io/callcenterai-backend:latest

# Push to ACR
docker push youracr.azurecr.io/callcenterai-backend:latest
```

**Frontend:**
```bash
cd frontend

# Build image with production environment variables
docker build \
  --build-arg VITE_ENTRA_CLIENT_ID=your-frontend-client-id \
  --build-arg VITE_ENTRA_TENANT_ID=your-tenant-id \
  --build-arg VITE_API_SCOPE=api://your-backend-client-id/access_as_user \
  -t callcenterai-frontend:latest .

# Tag for ACR
docker tag callcenterai-frontend:latest youracr.azurecr.io/callcenterai-frontend:latest

# Push to ACR
docker push youracr.azurecr.io/callcenterai-frontend:latest
```

### 2. Create Azure Resources

```bash
# Login to Azure
az login

# Set subscription
az account set --subscription "Your Subscription Name"

# Create resource group
az group create \
  --name rg-callcenterai \
  --location eastus

# Create Container Apps environment
az containerapp env create \
  --name callcenterai-env \
  --resource-group rg-callcenterai \
  --location eastus
```

### 3. Deploy Backend Container App

```bash
az containerapp create \
  --name callcenterai-backend \
  --resource-group rg-callcenterai \
  --environment callcenterai-env \
  --image youracr.azurecr.io/callcenterai-backend:latest \
  --target-port 8000 \
  --ingress external \
  --registry-server youracr.azurecr.io \
  --env-vars \
    ENTRA_TENANT_ID=your-tenant-id \
    ENTRA_CLIENT_ID=your-backend-client-id \
    ALLOWED_ORIGINS='["https://your-frontend-url.azurecontainerapps.io"]' \
  --cpu 0.5 \
  --memory 1Gi
```

Note the backend URL (e.g., `https://callcenterai-backend.eastus.azurecontainerapps.io`)

### 4. Deploy Frontend Container App

```bash
az containerapp create \
  --name callcenterai-frontend \
  --resource-group rg-callcenterai \
  --environment callcenterai-env \
  --image youracr.azurecr.io/callcenterai-frontend:latest \
  --target-port 80 \
  --ingress external \
  --registry-server youracr.azurecr.io \
  --cpu 0.5 \
  --memory 1Gi
```

Note the frontend URL (e.g., `https://callcenterai-frontend.eastus.azurecontainerapps.io`)

### 5. Update Entra ID App Registrations

**Frontend App Registration:**
1. Go to Azure Portal > App registrations > Your frontend app
2. Add the Container Apps frontend URL to:
   - **Authentication** > **Redirect URIs**: `https://your-frontend-url.azurecontainerapps.io`
   - **Logout URL**: `https://your-frontend-url.azurecontainerapps.io`

**Backend App Registration:**
1. Update CORS settings if needed in Container App environment variables

### 6. Configure Managed Identity (Recommended)

For enhanced security, use Managed Identity for communication between services:

```bash
# Enable managed identity on backend
az containerapp identity assign \
  --name callcenterai-backend \
  --resource-group rg-callcenterai \
  --system-assigned
```

---

## Security Considerations

### Production Best Practices

1. **Use Managed Identities**: Enable system-assigned managed identities for Container Apps
2. **Store Secrets in Key Vault**: Use Azure Key Vault for sensitive configuration
3. **Enable HTTPS Only**: Ensure Container Apps only accept HTTPS traffic
4. **Implement Rate Limiting**: Add rate limiting to API endpoints
5. **Monitor Authentication**: Enable Azure Monitor and Application Insights
6. **Regular Token Rotation**: Tokens are automatically rotated by Microsoft Entra ID
7. **Least Privilege**: Grant minimum required API permissions

### Token Security

- **Access tokens** are short-lived (typically 1 hour)
- **Refresh tokens** allow silent token renewal
- Tokens are stored in `sessionStorage` (cleared when browser closes)
- Never log or expose tokens in production

### CORS Configuration

- In production, strictly limit `ALLOWED_ORIGINS` to your actual frontend URLs
- Never use wildcard (`*`) in production

---

## Troubleshooting

### Common Issues

#### 1. "AADSTS50011: The redirect URI specified in the request does not match"
- **Solution**: Verify redirect URIs in Entra ID app registration match exactly

#### 2. "CORS policy error"
- **Solution**: Check `ALLOWED_ORIGINS` in backend `.env` includes your frontend URL

#### 3. "Invalid token signature"
- **Solution**: Verify `ENTRA_CLIENT_ID` and `ENTRA_TENANT_ID` are correct in backend config

#### 4. "Token acquisition failed"
- **Solution**: Check that API permissions are granted and admin consent provided

#### 5. Frontend shows "Cannot find module @azure/msal-browser"
- **Solution**: Run `npm install` in the frontend directory

#### 6. Backend shows "Module not found: jose"
- **Solution**: Run `pip install -r requirements.txt` in the backend directory

#### 7. CS Chatbot: "Failed to create session" or 403 Forbidden
- **Cause**: Missing or incorrect Power Platform API permissions
- **Solution**: 
  - Add **Delegated** permission (not Application): `https://api.powerplatform.com/.default`
  - Verify client secret is correct (use Value, not ID)
  - Check that user has access to the Copilot Studio agent
  - See `COPILOT-STUDIO-INTEGRATION.md` for detailed setup

#### 8. CS Chatbot: "Copilot Studio is not configured"
- **Cause**: Missing `COPILOT_STUDIO_*` environment variables
- **Solution**: Add all required variables to `backend/.env` (see `.env.example`)

### Debug Mode

**Frontend:**
- Check browser console for MSAL logs
- MSAL logs can be enabled in `authConfig.ts`

**Backend:**
- Check FastAPI logs for JWT validation errors
- Enable debug logging in `main.py`

### Testing Endpoints

```bash
# Test backend health (public)
curl http://localhost:8000/health

# Test protected endpoint (requires token)
curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  http://localhost:8000/api/user/profile
```

---

## Architecture Overview

```
┌─────────────┐         ┌──────────────────┐         ┌─────────────┐
│   Browser   │────────>│  Microsoft       │────────>│   Backend   │
│  (React +   │  Auth   │  Entra ID        │  Token  │  (FastAPI)  │
│   MSAL.js)  │<────────│  OAuth 2.0 /     │<────────│  JWT Valid. │
└─────────────┘         │  OIDC            │         └─────────────┘
                        └──────────────────┘
```

### Authentication Flow

1. User clicks "Sign in with Microsoft"
2. Frontend redirects to Microsoft Entra ID login page
3. User authenticates with Microsoft credentials
4. Entra ID redirects back with authorization code
5. MSAL.js exchanges code for access token
6. Frontend stores token in sessionStorage
7. Frontend sends API requests with token in Authorization header
8. Backend validates token signature and claims
9. Backend returns protected data

---

## Additional Resources

- [Microsoft Entra ID Documentation](https://learn.microsoft.com/entra/identity/)
- [MSAL.js Documentation](https://github.com/AzureAD/microsoft-authentication-library-for-js)
- [MSAL Python Documentation](https://msal-python.readthedocs.io/)
- [On-Behalf-Of Flow](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-on-behalf-of-flow)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Azure Container Apps Documentation](https://learn.microsoft.com/azure/container-apps/)
- [Copilot Studio Integration Guide](./COPILOT-STUDIO-INTEGRATION.md)

---

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review Azure Entra ID audit logs
3. Check Container Apps logs in Azure Portal
4. Enable debug logging in both frontend and backend
