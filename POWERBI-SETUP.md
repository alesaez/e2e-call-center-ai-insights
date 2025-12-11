# Power BI Embedded Report Setup

This guide explains how to configure Power BI embedded reports in the Call Center AI Insights application using **On-Behalf-Of (OBO) flow** for secure, user-based access.

## 🎯 Architecture Overview

The Power BI feature uses a **backend-based OBO flow** architecture:

- ✅ **Backend handles all Power BI API calls** - No tokens exposed in frontend
- ✅ **On-Behalf-Of (OBO) authentication** - Uses logged-in user's permissions
- ✅ **Automatic token generation** - Backend creates embed tokens on-demand
- ✅ **User-based access control** - Users view reports with their own Power BI permissions
- ✅ **No manual configuration needed** - Users don't need to manage tokens or settings

```
┌─────────┐              ┌─────────┐              ┌──────────────┐
│ Browser │ ─JWT Token─> │ Backend │ ─OBO Flow──> │  Power BI    │
│         │ <─Embed──────│   API   │ <─Token─────│     API      │
└─────────┘   Config     └─────────┘              └──────────────┘
```

## 📋 Prerequisites

1. **Power BI License**: Users must have Power BI Pro or Premium Per User license
2. **Workspace Access**: Users must have access to the Power BI workspace
3. **Backend App Registration**: Configured with Power BI API permissions

## 🔧 Setup Steps

### Step 1: Configure Backend App Registration API Permissions

The backend app registration needs the following **delegated permissions** for OBO flow:

**Required API Permissions:**

| API | Permission | Type | Description | Admin Consent Required |
|-----|------------|------|-------------|----------------------|
| **Power BI Service** | `Report.Read.All` | Delegated | View all reports | No |
| **Power BI Service** | `Dataset.Read.All` | Delegated | View all datasets | No |
| **Power BI Service** | `PaginatedReport.Read.All` | Delegated | Read paginated reports | No |
| **Microsoft Graph** | `User.Read` | Delegated | Sign in and read user profile | No |
| **Microsoft Graph** | `openid` | Delegated | Sign users in | No |
| **Microsoft Graph** | `profile` | Delegated | View users' basic profile | No |

**Optional (if using other features):**
- **Azure Machine Learning Services**: `user_impersonation` (for AI Foundry)
- **Power Platform API**: `CopilotStudio.Copilots.Invoke` (for Copilot Studio)

**To add these permissions:**

1. Go to [Azure Portal](https://portal.azure.com) → **Azure Active Directory** → **App registrations**
2. Find your backend app registration (client ID from `ENTRA_BACKEND_CLIENT_ID`)
3. Go to **API permissions** → **Add a permission**
4. Select **Power BI Service**
5. Choose **Delegated permissions**
6. Add: `Report.Read.All`, `Dataset.Read.All`, `PaginatedReport.Read.All`
7. Click **Add permissions**
8. **Click "Grant admin consent for [Your Organization]"** ← Important!

### Step 2: Configure Backend Environment Variables

Add these to `backend/.env`:

```bash
# Power BI Configuration (uses OBO flow with user's permissions)
POWERBI_TENANT_ID=your-tenant-id
POWERBI_CLIENT_ID=your-backend-client-id
POWERBI_CLIENT_SECRET=your-backend-client-secret
POWERBI_WORKSPACE_ID=your-workspace-id
POWERBI_REPORT_ID=your-report-id
```

**How to get these values:**

- **POWERBI_TENANT_ID**: Your Azure AD tenant ID (same as `ENTRA_TENANT_ID`)
- **POWERBI_CLIENT_ID**: Backend app registration client ID (same as `ENTRA_BACKEND_CLIENT_ID`)
- **POWERBI_CLIENT_SECRET**: Backend app registration client secret
- **POWERBI_WORKSPACE_ID**: From Power BI workspace URL: `https://app.powerbi.com/groups/{WORKSPACE_ID}/...`
- **POWERBI_REPORT_ID**: From Power BI report URL or File → Embed report

### Step 3: Configure Azure Deployment (Optional)

For Azure deployment, add these to `deploy-config.ps1`:

```powershell
# Power BI Configuration (OBO flow)
$PowerBITenantId = "your-tenant-id"
$PowerBIClientId = "your-backend-client-id"  
$PowerBIClientSecret = "your-backend-client-secret"
$PowerBIWorkspaceId = "your-workspace-id"
$PowerBIReportId = "your-report-id"
```

Then deploy:
```powershell
.\deploy-azure.ps1
```

### Step 4: Verify User Access

Ensure users have access to the Power BI workspace:

1. Go to [Power BI Service](https://app.powerbi.com)
2. Navigate to your workspace
3. Click **Settings** → **Workspace access**
4. Add users or Azure AD groups with **Viewer** role or higher

## 🎯 How It Works

### Authentication Flow

1. **User logs into the app** with Azure AD credentials
2. **Frontend calls backend** API endpoint: `GET /api/powerbi/embed-config`
3. **Backend receives user's JWT token** from Authorization header
4. **Backend uses OBO flow**:
   - Exchanges user's token for Power BI access token
   - User's identity and permissions are preserved
5. **Backend fetches report metadata** from Power BI API (as the user)
6. **Backend generates embed token** (valid for 60 minutes)
7. **Backend returns** complete embed configuration to frontend
8. **Frontend embeds report** using the provided token

### Security Benefits

- 🔒 **No tokens in frontend code** - Embed tokens generated server-side
- 🔒 **User-based permissions** - Each user sees what they're allowed to see in Power BI
- 🔒 **Automatic token refresh** - Frontend can request new tokens when needed
- 🔒 **No service principal workspace access needed** - Uses user's permissions
- 🔒 **Audit trail** - Power BI logs show actual user activity

## 📱 Using the Feature

### For End Users

1. **Log into the application** with your Azure AD credentials
2. **Navigate to** "Power BI Report" from the main menu
3. **Report loads automatically** - No configuration needed!

**Requirements for users:**
- ✅ Power BI Pro or Premium Per User license
- ✅ Access to the workspace (Viewer role or higher)
- ✅ Logged into the application with Azure AD

### Refresh Token

If the embed token expires (after 60 minutes), users can:
- Click the **"Refresh"** button in the top-right corner
- The report will reload with a new token automatically

## 🔍 Troubleshooting

### "Power BI service is not configured"

**Cause**: Backend environment variables not set

**Solution**:
1. Check `backend/.env` has all POWERBI_* variables
2. Restart backend server
3. Check backend logs for initialization errors

### "Failed to acquire Power BI access token via OBO"

**Cause**: Backend app doesn't have Power BI API permissions or admin consent not granted

**Solution**:
1. Verify Power BI Service permissions added to backend app registration
2. Ensure admin consent was granted (green checkmarks in Azure AD)
3. Wait 5-10 minutes for permissions to propagate

### "Failed to fetch report metadata: 403"

**Cause**: User doesn't have access to the workspace or report

**Solution**:
1. Add user to Power BI workspace with Viewer role or higher
2. Ensure user has Power BI Pro or Premium Per User license
3. Verify workspace and report IDs are correct in backend configuration

### Report shows blank or loads slowly

**Cause**: Large report or network latency

**Solution**:
1. Optimize Power BI report performance
2. Reduce report complexity and data volume
3. Use report filters to limit initial data load

### "At least one dataset is required" error

**Cause**: Backend unable to retrieve dataset ID from report metadata

**Solution**:
1. Ensure report is published and not deleted
2. Verify POWERBI_WORKSPACE_ID and POWERBI_REPORT_ID are correct
3. Check that user (and backend via OBO) can access the report

## 📚 Additional Resources

- [Power BI Embedded Documentation](https://learn.microsoft.com/power-bi/developer/embedded/)
- [Power BI REST API](https://learn.microsoft.com/rest/api/power-bi/)
- [On-Behalf-Of Flow](https://learn.microsoft.com/azure/active-directory/develop/v2-oauth2-on-behalf-of-flow)
- [Power BI Licensing](https://powerbi.microsoft.com/pricing/)

## 🎉 Summary

After completing the setup:

1. ✅ Backend app has Power BI API delegated permissions with admin consent
2. ✅ Backend configured with workspace and report IDs
3. ✅ Users have Power BI licenses and workspace access
4. ✅ Reports load automatically using user's permissions
5. ✅ No frontend configuration or token management needed

Users can now view Power BI reports securely through the application using their own Power BI permissions!

- The embed token may be expired (generate a new one)
- The report ID or URL may be incorrect
- Check that you have permission to access the report

### Configuration not persisting

- Ensure browser localStorage is enabled
- Check that you're using the same browser/device
- Private/Incognito mode doesn't persist localStorage

## Security Best Practices

1. **Never commit embed tokens** to source control
2. **Use environment variables** for deployment configuration
3. **Implement token refresh** in production
4. **Use service principals** for authentication in backend services
5. **Rotate tokens regularly** and use short expiration times
6. **Implement proper CORS** policies for your Power BI workspace

## Example Production Setup

For a production deployment:

1. Create an Azure AD service principal with Power BI access
2. Store credentials in Azure Key Vault
3. Create a backend endpoint `/api/powerbi/token` that:
   - Authenticates the user
   - Generates a fresh embed token using the service principal
   - Returns the token to the frontend
4. Update the frontend to fetch tokens from this endpoint
5. Implement token refresh logic before expiration

This ensures tokens are never exposed in build artifacts and are always fresh.
