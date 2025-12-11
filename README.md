# Call Center AI Insights

A comprehensive React + Python (FastAPI) web application with Microsoft Entra ID SSO authentication, interactive dashboards, and AI-powered chatbot integration.

## Features

- 🔐 **Microsoft Entra ID SSO** using OAuth 2.0 / OpenID Connect
- ⚛️ **React Frontend** with MSAL.js for authentication
- 🐍 **FastAPI Backend** with JWT token validation
- 📊 **Interactive Dashboard** with KPIs and charts (Material-UI + Recharts)
- 🤖 **CS Chatbot** integration with Microsoft Copilot Studio (On-Behalf-Of flow)
- 💬 **Real-time Chat** with auto-scroll and clickable links
- � **Chat History** with Azure Cosmos DB persistence and two-container architecture
- 🔍 **Conversation Management** with search, delete, and session tracking
- 🛡️ **Error Resilience** with comprehensive error boundaries and graceful degradation
- �🔒 **Secure API Endpoints** with Bearer token authentication
- 🔄 **Automatic Token Refresh** with silent authentication
- 🎨 **White-labeling Support** with theme customization
- 📦 **Docker Support** for containerization
- ☁️ **Azure Container Apps Ready** for cloud deployment

## Project Structure

```
.
├── frontend/                 # React frontend application
│   ├── src/
│   │   ├── components/      # React components
│   │   │   ├── Dashboard.tsx
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── ChatbotPage.tsx      # CS Chatbot integration
│   │   │   ├── LoginPage.tsx
│   │   │   └── ProtectedRoute.tsx
│   │   ├── services/        # API client and MSAL instance
│   │   │   ├── apiClient.ts
│   │   │   └── msalInstance.ts
│   │   ├── App.tsx          # Main app component with routing
│   │   ├── main.tsx         # Entry point
│   │   ├── authConfig.ts    # MSAL configuration
│   │   └── vite-env.d.ts    # TypeScript declarations
│   ├── Dockerfile           # Frontend Docker configuration
│   ├── nginx.conf           # Nginx configuration for production
│   ├── package.json         # Node dependencies
│   ├── tsconfig.json        # TypeScript configuration
│   ├── vite.config.ts       # Vite build configuration
│   └── .env.example         # Environment variables template
│
├── backend/                 # FastAPI backend application
│   ├── main.py             # Main FastAPI application with Copilot Studio integration
│   ├── config.py           # Configuration management (Pydantic settings)
│   ├── models.py           # Data models
│   ├── chat_models.py      # Chat history and conversation models
│   ├── cosmos_service.py   # Azure Cosmos DB service layer
│   ├── Dockerfile          # Backend Docker configuration
│   ├── requirements.txt    # Python dependencies
│   └── .env.example        # Environment variables template
│
├── SETUP-SSO.md            # Detailed SSO setup guide
├── COPILOT-STUDIO-INTEGRATION.md  # CS Chatbot integration guide
├── GETTING-STARTED.md      # Quick start checklist
├── deploy-azure.ps1        # Azure Container Apps deployment script
├── start-dev.ps1           # Local development startup script
└── README.md               # This file
```

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.11+
- Azure subscription
- Docker (for containerization)

### 1. Clone the Repository

```bash
git clone https://github.com/alesaez/e2e-call-center-ai-insights.git
cd e2e-call-center-ai-insights
```

### 2. Setup Azure Entra ID

Follow the detailed instructions in [SETUP-SSO.md](./SETUP-SSO.md) to:
1. Register backend API application
2. Register frontend application
3. Configure API permissions and scopes

### 3. Configure Environment Variables

**Backend:**
```bash
cd backend
cp .env.example .env
# Edit .env with your Azure Entra ID values
```

**Frontend:**
```bash
cd frontend
cp .env.example .env.local
# Edit .env.local with your Azure Entra ID values
```

### 4. Run Locally

**Quick Start (Windows):**
```powershell
.\start-dev.ps1
```

**Manual Start:**

Backend:
```bash
cd backend
python -m venv venv
.\venv\Scripts\activate  # Windows
pip install -r requirements.txt
python main.py
```

Frontend:
```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000` in your browser.

## API Endpoints

### Public Endpoints

- `GET /health` - Health check endpoint

### Protected Endpoints (Require Authentication)

- `GET /api/user/profile` - Get authenticated user profile
- `GET /api/dashboard/kpis` - Get dashboard KPI data
- `POST /api/copilot-studio/session` - Create Copilot Studio chat session
- `POST /api/copilot-studio/send-message` - Send message to CS Chatbot

### Chat History Endpoints

- `GET /api/chat/conversations` - Get user's conversation history
- `POST /api/chat/conversations` - Create new conversation
- `GET /api/chat/conversations/{id}` - Get specific conversation with messages
- `GET /api/chat/conversations/{id}/messages` - Get messages for conversation
- `POST /api/chat/conversations/{id}/messages` - Add message to conversation
- `DELETE /api/chat/conversations/{id}` - Delete conversation

## Authentication Flow

1. User navigates to application
2. Unauthenticated users are redirected to login page
3. User clicks "Sign in with Microsoft"
4. MSAL.js redirects to Microsoft Entra ID login
5. User authenticates with Microsoft credentials
6. User is redirected back to application with tokens
7. Access token is automatically included in API requests
8. Backend validates token and returns protected data

## Deployment to Azure Container Apps

See [SETUP-SSO.md](./SETUP-SSO.md) for complete deployment instructions.

**Quick Deploy:**

```bash
# Build and push images
docker build -t youracr.azurecr.io/callcenterai-backend:latest ./backend
docker push youracr.azurecr.io/callcenterai-backend:latest

docker build -t youracr.azurecr.io/callcenterai-frontend:latest ./frontend
docker push youracr.azurecr.io/callcenterai-frontend:latest

# Deploy to Azure Container Apps
az containerapp create --name callcenterai-backend ...
az containerapp create --name callcenterai-frontend ...
```

## Technology Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **MSAL React** - Microsoft authentication library
- **React Router** - Client-side routing
- **Material-UI (MUI)** - Component library and theming
- **Recharts** - Chart components for dashboard
- **Axios** - HTTP client
- **Vite** - Build tool

### Backend
- **FastAPI** - Modern Python web framework
- **Python-JOSE** - JWT token validation
- **Pydantic** - Data validation and settings management
- **MSAL** - Microsoft Authentication Library (On-Behalf-Of flow)
- **microsoft-agents-copilotstudio-client** - Copilot Studio integration
- **Azure Cosmos DB SDK** - Chat history persistence with two-container architecture
- **Azure Identity** - DefaultAzureCredential for secure authentication
- **Uvicorn** - ASGI server
- **HTTPX** - Async HTTP client

## Security Features

- ✅ OAuth 2.0 / OpenID Connect authentication
- ✅ JWT token validation with signature verification
- ✅ Automatic token refresh
- ✅ CORS protection
- ✅ HTTPS-only in production
- ✅ Secure token storage (sessionStorage)
- ✅ Non-root Docker containers
- ✅ Security headers (X-Frame-Options, CSP, etc.)

## Development

### Frontend Development

```bash
cd frontend
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
```

### Backend Development

```bash
cd backend
python main.py       # Start development server

# With auto-reload
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Run Tests

```bash
# Frontend
cd frontend
npm test

# Backend
cd backend
pytest
```

## Environment Variables

### Frontend (`.env.local`)

```env
VITE_ENTRA_CLIENT_ID=your-frontend-client-id
VITE_ENTRA_TENANT_ID=your-tenant-id
VITE_REDIRECT_URI=http://localhost:3000
VITE_POST_LOGOUT_REDIRECT_URI=http://localhost:3000
VITE_API_BASE_URL=http://localhost:8000
VITE_API_SCOPE=api://your-backend-client-id/access_as_user
```

### Backend (`.env`)

```env
ENTRA_TENANT_ID=your-tenant-id
ENTRA_CLIENT_ID=your-backend-client-id
ALLOWED_ORIGINS=["http://localhost:3000","http://localhost:5173"]

# Optional: Copilot Studio Configuration (for CS Chatbot)
COPILOT_STUDIO_ENVIRONMENT_ID=your-environment-id
COPILOT_STUDIO_SCHEMA_NAME=your-agent-schema-name
COPILOT_STUDIO_TENANT_ID=your-tenant-id
COPILOT_STUDIO_APP_CLIENT_ID=your-backend-client-id
COPILOT_STUDIO_APP_CLIENT_SECRET=your-client-secret

# Optional: Azure Cosmos DB Configuration (for Chat History)
# Uses DefaultAzureCredential for localhost and ManagedIdentityCredential for Azure Container Apps
COSMOS_DB_ACCOUNT_URI=https://your-account.documents.azure.com:443/
COSMOS_DB_DATABASE_NAME=ContosoSuites
COSMOS_DB_SESSIONS_CONTAINER=Sessions
COSMOS_DB_MESSAGES_CONTAINER=Messages
```

## Troubleshooting

See the [Troubleshooting section](./SETUP-SSO.md#troubleshooting) in SETUP-SSO.md for common issues and solutions.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License.

## Additional Resources

- [Microsoft Entra ID Documentation](https://learn.microsoft.com/entra/identity/)
- [MSAL.js GitHub](https://github.com/AzureAD/microsoft-authentication-library-for-js)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Azure Container Apps Documentation](https://learn.microsoft.com/azure/container-apps/)

## Support

For detailed setup instructions, see [SETUP-SSO.md](./SETUP-SSO.md).

For issues:
1. Check the troubleshooting guide
2. Review application logs
3. Check Azure Entra ID audit logs
4. Open an issue in the repository
