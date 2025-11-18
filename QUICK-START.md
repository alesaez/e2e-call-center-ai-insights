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

## Step 2: Start the Backend (2 minutes)

Open a PowerShell terminal:

```powershell
cd c:\Users\algut\repos\alesaez\e2e-call-center-ai-insights\backend

# Activate virtual environment
.\venv\Scripts\Activate.ps1

# Start the server
uvicorn main:app --reload
```

✅ **Verification:** You should see:
```
INFO:     Uvicorn running on http://127.0.0.1:8000
INFO:     Application startup complete.
```

## Step 3: Start the Frontend (1 minute)

Open a **NEW** PowerShell terminal:

```powershell
cd c:\Users\algut\repos\alesaez\e2e-call-center-ai-insights\frontend

# Start the dev server
npm run dev
```

✅ **Verification:** You should see:
```
VITE v5.x.x  ready in xxx ms

➜  Local:   http://localhost:3000/
```

## Step 4: Test the Application (5 minutes)

### 4.1 Open the Application
- Navigate to: http://localhost:3000
- You should see the Microsoft login page

### 4.2 Sign In
- Click "Sign in with Microsoft"
- Use your Microsoft/Entra ID credentials
- Grant any requested permissions
- You should be redirected to the dashboard

### 4.3 Verify Dashboard Components

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

### 4.4 Test Navigation

**Sidebar Navigation:**
- [ ] Click hamburger menu (☰) - sidebar should expand
- [ ] Click it again - sidebar should collapse
- [ ] Click **Dashboard** - should show dashboard (current page)
- [ ] Click **Chatbot** - should show placeholder page
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

### 4.5 Test Responsive Design

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

## Step 5: Check Browser Console (Optional)

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
