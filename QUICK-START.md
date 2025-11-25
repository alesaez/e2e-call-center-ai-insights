# Quick Start Guide - Dashboard Testing

## Prerequisites Completed ✅
- All npm packages installed (Material-UI, Recharts, etc.)
- Dashboard components created
- Backend endpoints ready
- Routing configured

## Step 1: Fix Azure App Registration (CRITICAL - 5 minutes)

**Why this matters:** Without this fix, you'll be stuck in a login redirect loop with error `AADSTS9002326`.

1. Open [Azure Portal](https://portal.azure.com)
2. Go to **App registrations** → Find your frontend app
3. Click **Authentication** in the left menu
4. Under **Platform configurations**:
   - **Remove** any "Web" platform
   - Click **+ Add a platform**
   - Select **Single-page application**
   - Enter redirect URI: `http://localhost:3000`
   - Click **Configure**
5. Click **Save** at the top

✅ **Verification:** You should see "Single-page application" listed under Platform configurations

## Step 2: Start the Backend (3 minutes)

Open a PowerShell terminal:

```powershell
cd .\e2e-call-center-ai-insights\backend

# Create virtual environment if it doesn't exist
if (-not (Test-Path venv)) {
    python -m venv venv
}

# Activate virtual environment
.\venv\Scripts\Activate.ps1

# Install/update dependencies
pip install -r requirements.txt

# Start the server
python -m uvicorn main:app --reload --port 8000
```

✅ **Verification:** You should see:
```
INFO:     Uvicorn running on http://127.0.0.1:8000
INFO:     Application startup complete.
```

⚠️ **Expected Cosmos DB Warning:** You may see Cosmos DB firewall errors - this is normal and will be fixed in the next steps.

## Step 3: Start the Frontend (1 minute)

Open a **NEW** PowerShell terminal:

```powershell
cd .\e2e-call-center-ai-insights\frontend

# Start the dev server
npm run dev
```

✅ **Verification:** You should see:
```
VITE v5.x.x  ready in xxx ms

➜  Local:   http://localhost:3000/
```

## Step 4: Configure Chat History (Optional - 10 minutes)

**Note:** Chat history requires Azure Cosmos DB with a **two-container architecture**. Skip this step if you don't need chat persistence.

### 4.1 Create Cosmos DB Account and Containers

If you don't have a Cosmos DB account yet:

1. Open [Azure Portal](https://portal.azure.com)
2. Create a new **Azure Cosmos DB** resource (SQL API)
3. Create a database named `ContosoSuites`
4. Create two containers:
   - **Sessions** container with partition key: `/userId`
   - **Messages** container with partition key: `/sessionId`

### 4.2 Configure Backend Environment

Update your `backend/.env` file:

```env
# Add these Cosmos DB settings
COSMOS_DB_ACCOUNT_URI=https://your-account.documents.azure.com:443/
COSMOS_DB_DATABASE_NAME=CallCenterAI
COSMOS_DB_SESSIONS_CONTAINER=Sessions
COSMOS_DB_MESSAGES_CONTAINER=Messages

# Optional: Use connection string instead of DefaultAzureCredential
# COSMOS_DB_CONNECTION_STRING=AccountEndpoint=...;AccountKey=...;
```

### 4.3 Fix Cosmos DB Firewall (if needed)
If you see Cosmos DB firewall errors in the backend terminal:

1. Open [Azure Portal](https://portal.azure.com)
2. Navigate to your Cosmos DB account
3. Go to **Settings** → **Networking**
4. Under **Firewall and virtual networks**:
   - Select **Allow access from Azure portal**
   - Add your current IP address
   - Click **Save**

### 4.4 Configure Authentication
The backend automatically uses **DefaultAzureCredential** for localhost:

```powershell
# Ensure you're logged in to Azure CLI
az login

# Verify your identity
az account show
```

✅ **Verification:** Backend should show:
```
INFO:cosmos_service:Using DefaultAzureCredential for Cosmos DB authentication (localhost)
INFO:cosmos_service:Cosmos DB initialized: CallCenterAI with containers Sessions, Messages
INFO:cosmos_service:Sessions container ready (partition: /userId)
INFO:cosmos_service:Messages container ready (partition: /sessionId)
```

### 4.5 Architecture Benefits
The new two-container design provides:
- **Better Performance**: Each container optimized for specific queries
- **Cost Efficiency**: Reduced cross-partition queries save RUs
- **Scalability**: Independent scaling per container
- **Future-Ready**: Supports advanced features like vector search

## Step 5: Test the Application (5 minutes)

### 5.1 Open the Application
- Navigate to: http://localhost:3000
- You should see the Microsoft login page

### 5.2 Sign In
- Click "Sign in with Microsoft"
- Use your Microsoft/Entra ID credentials
- Grant any requested permissions
- You should be redirected to the dashboard

### 5.3 Test Chat History (if configured)
- Navigate to the **Chatbot** page
- Look for "Chat History" and "New Chat" buttons in the header
- Try creating a conversation
- Verify messages are saved and can be retrieved

### 5.4 Verify Dashboard Components

**Check KPIs (Top Section):**
- [ ] Total Calls card displays (with phone icon)
- [ ] Average Handling Time card displays (with timer icon)
- [ ] Customer Satisfaction card displays (with star icon)
- [ ] Agent Availability card displays (with people icon)
- [ ] Escalation Rate card displays (with trending icon)
- [ ] All KPIs show trend indicators (↑ or ↓ with percentage)

**Check Charts (Main Section):**
- [ ] Call Volume Trend (area chart, 7 days) displays
- [ ] Satisfaction Breakdown (pie chart, 5 ratings) displays with colors
- [ ] Calls by Hour (bar chart, 10 hours) displays
- [ ] Agent Performance (bar chart, 5 agents) displays

### 5.5 Test Navigation

**Sidebar Navigation:**
- [ ] Click hamburger menu (☰) - sidebar should expand
- [ ] Click it again - sidebar should collapse
- [ ] Click **Dashboard** - should show dashboard (current page)
- [ ] Click **Chatbot** - should show chatbot page with history functionality
- [ ] Click **Settings** - should show placeholder page
- [ ] Navigate back to Dashboard

**User Profile:**
- [ ] Verify your name displays in sidebar
- [ ] Verify your email displays in sidebar
- [ ] Verify avatar shows your initials

**Sign Out:**
- [ ] Click "SIGN OUT" button in sidebar
- [ ] Should redirect to login page
- [ ] Sign back in to continue testing

### 5.6 Test Responsive Design

**Desktop View:**
- [ ] Resize browser window to desktop size (>900px)
- [ ] Sidebar should be persistent (always visible)
- [ ] KPIs should display in a row
- [ ] Charts should show 2 per row

**Mobile View:**
- [ ] Resize browser window to mobile size (<900px)
- [ ] Sidebar should be hidden by default
- [ ] Hamburger menu should appear in top bar
- [ ] KPIs should stack vertically
- [ ] Charts should stack vertically
- [ ] Clicking hamburger should show sidebar overlay

## Step 6: Check Browser Console (Optional)

Press `F12` to open DevTools:

### Console Tab
Look for these successful logs:
```
Starting login redirect...
Login redirect successful
User authenticated, showing protected content
```

❌ **If you see errors:**
- `AADSTS9002326` → Azure app registration not fixed (go back to Step 1)
- Network errors → Check backend is running (Step 2)
- Import errors → Run `npm install` again

### Network Tab
Verify these API calls succeed:
- ✅ `GET /api/dashboard/kpis` → Status 200
- ✅ `GET /api/dashboard/charts` → Status 200

## Troubleshooting

### Problem: Login redirect loop
**Solution:** Complete Step 1 (Azure app registration fix)
**Verify:** Check that "Single-page application" is selected in Azure Portal

### Problem: Dashboard shows loading forever
**Check:**
1. Backend is running (`uvicorn` terminal should show no errors)
2. Network tab shows API calls returning 200
3. No CORS errors in console

**Solution:** Restart backend, check `.env` file has correct values

### Problem: Charts not displaying
**Check:**
1. Browser console for errors
2. Recharts imported correctly
3. Data is loading (check Network tab)

**Solution:** 
```powershell
cd frontend
npm install recharts --save
```

### Problem: Styling looks broken
**Check:**
1. Material-UI installed
2. No CSS errors in console

**Solution:**
```powershell
cd frontend
npm install @mui/material @emotion/react @emotion/styled
```

### Problem: TypeScript errors
**Check:**
1. All packages installed
2. VS Code using workspace TypeScript

**Solution:**
1. `npm install` in frontend directory
2. Restart VS Code TypeScript server: `Ctrl+Shift+P` → "TypeScript: Restart TS Server"

## Success! 🎉

If you've checked all the boxes above, your dashboard is working correctly!

## What's Next?

### Immediate Next Steps:
1. **Replace Mock Data** - Update backend endpoints to use real call center data
2. **Implement Chatbot** - Follow `prompts/3-chatbot.md` requirements
3. **Customize Theme** - Update `frontend/src/theme/theme.ts` with your brand colors

### Enhancement Ideas:
- Add date range picker for filtering
- Implement real-time data updates
- Add export functionality (PDF/CSV)
- Create more detailed drill-down views
- Add user preferences in Settings page

## Getting Help

### Check These Files:
- `DASHBOARD-CHECKLIST.md` - Complete implementation checklist
- `prompts/2-dashboard-implementation.md` - Detailed implementation summary
- `prompts/1-sso.md` - SSO authentication details
- `docs/ARCHITECTURE.md` - System architecture

### Common Issues:
- **Login problems** → Check `docs/SETUP-SSO.md`
- **API errors** → Check `backend/main.py` and `.env` file
- **UI issues** → Check browser console and Material-UI documentation

### Need to Reset?
```powershell
# Frontend
cd frontend
rm -rf node_modules package-lock.json
npm install

# Backend
cd backend
rm -rf venv
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

---

**Estimated Total Time:** 15-20 minutes
**Difficulty:** Easy (following steps)
**Prerequisites:** Azure account with app registration access

Good luck! 🚀
