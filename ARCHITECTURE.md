# Architecture Documentation

## System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Browser                             │
│  ┌────────────────────────────────────────────────────────┐    │
│  │           React SPA (Frontend)                          │    │
│  │  • MSAL.js for authentication                           │    │
│  │  • Protected routes with ProtectedRoute component       │    │
│  │  • Axios client with token interceptors                 │    │
│  │  • sessionStorage for token management                  │    │
│  └────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                            │
                            │ HTTPS
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│  Microsoft   │   │   Backend    │   │  Static      │
│  Entra ID    │   │   API        │   │  Assets      │
│  (Azure AD)  │   │  (FastAPI)   │   │  (Nginx)     │
│              │   │              │   │              │
│ • OAuth 2.0  │   │ • JWT Valid. │   │ • SPA        │
│ • OIDC       │   │ • JWKS       │   │   Hosting    │
│ • Token      │   │ • Protected  │   │ • Gzip       │
│   Issuance   │   │   Endpoints  │   │ • Security   │
└──────────────┘   └──────────────┘   └──────────────┘
```

## Authentication Flow

### 1. Initial Login Flow

```
┌──────┐                ┌──────────┐              ┌──────────┐
│ User │                │  React   │              │ Entra ID │
│      │                │   App    │              │          │
└──┬───┘                └────┬─────┘              └────┬─────┘
   │                         │                         │
   │  1. Visit App           │                         │
   │────────────────────────>│                         │
   │                         │                         │
   │  2. Redirect to Login   │                         │
   │<────────────────────────│                         │
   │                         │                         │
   │  3. Click "Sign In"     │                         │
   │────────────────────────>│                         │
   │                         │                         │
   │                         │  4. Redirect to Entra   │
   │                         │────────────────────────>│
   │                                                    │
   │  5. Microsoft Login Page                          │
   │<──────────────────────────────────────────────────│
   │                                                    │
   │  6. Enter Credentials                             │
   │───────────────────────────────────────────────────>
   │                                                    │
   │  7. Authorization Code                            │
   │<──────────────────────────────────────────────────│
   │                         │                         │
   │  8. Redirect with Code  │                         │
   │────────────────────────>│                         │
   │                         │                         │
   │                         │  9. Exchange Code       │
   │                         │────────────────────────>│
   │                         │                         │
   │                         │  10. Access Token       │
   │                         │<────────────────────────│
   │                         │                         │
   │  11. Show Dashboard     │                         │
   │<────────────────────────│                         │
```

### 2. API Request Flow

```
┌──────────┐         ┌──────────┐         ┌──────────┐
│  React   │         │  Axios   │         │ FastAPI  │
│   App    │         │  Client  │         │ Backend  │
└────┬─────┘         └────┬─────┘         └────┬─────┘
     │                    │                    │
     │  1. API Call       │                    │
     │───────────────────>│                    │
     │                    │                    │
     │                    │  2. Get Token      │
     │                    │    from MSAL       │
     │                    │                    │
     │                    │  3. Add Bearer     │
     │                    │     Token Header   │
     │                    │                    │
     │                    │  4. HTTP Request   │
     │                    │───────────────────>│
     │                    │                    │
     │                    │                    │  5. Validate
     │                    │                    │     Token
     │                    │                    │
     │                    │  6. Response       │
     │                    │<───────────────────│
     │                    │                    │
     │  7. Return Data    │                    │
     │<───────────────────│                    │
```

### 3. Token Refresh Flow

```
┌──────────┐         ┌──────────┐         ┌──────────┐
│  Axios   │         │   MSAL   │         │ Entra ID │
│  Client  │         │ Instance │         │          │
└────┬─────┘         └────┬─────┘         └────┬─────┘
     │                    │                    │
     │  1. API Call       │                    │
     │    (401 Error)     │                    │
     │                    │                    │
     │  2. Request Token  │                    │
     │    Refresh         │                    │
     │───────────────────>│                    │
     │                    │                    │
     │                    │  3. Silent Token   │
     │                    │     Acquisition    │
     │                    │───────────────────>│
     │                    │                    │
     │                    │  4. New Token      │
     │                    │<───────────────────│
     │                    │                    │
     │  5. Return Token   │                    │
     │<───────────────────│                    │
     │                    │                    │
     │  6. Retry Request  │                    │
     │    with New Token  │                    │
```

## Component Architecture

### Frontend Components

```
src/
├── main.tsx                    # Application entry point
│   └── MsalProvider            # MSAL authentication context
│       └── BrowserRouter       # React Router context
│           └── App.tsx
│
├── App.tsx                     # Main routing component
│   ├── Route: /login
│   │   └── LoginPage           # Public login page
│   ├── Route: /dashboard
│   │   └── ProtectedRoute      # Authentication guard
│   │       └── Dashboard       # Protected dashboard
│   └── Route: /
│       └── Navigate to /dashboard
│
├── components/
│   ├── LoginPage.tsx           # Microsoft login button
│   ├── Dashboard.tsx           # Main application view
│   └── ProtectedRoute.tsx      # Route protection wrapper
│
├── services/
│   ├── apiClient.ts            # Axios instance
│   │   ├── Request Interceptor  # Add Bearer token
│   │   └── Response Interceptor # Handle 401, retry
│   └── msalInstance.ts         # MSAL singleton
│
└── authConfig.ts               # MSAL configuration
    ├── msalConfig              # Client & authority
    ├── loginRequest            # User scopes
    └── apiRequest              # API scopes
```

### Backend Components

```
backend/
├── main.py                     # FastAPI application
│   ├── CORS Middleware         # Cross-origin config
│   ├── Security (HTTPBearer)   # Token extraction
│   ├── get_jwks()              # Fetch signing keys
│   ├── verify_token()          # JWT validation
│   └── Protected Endpoints
│       ├── /api/user/profile
│       └── /api/dashboard/kpis
│
└── config.py                   # Settings management
    └── Settings (Pydantic)
        ├── ENTRA_TENANT_ID
        ├── ENTRA_CLIENT_ID
        └── ALLOWED_ORIGINS
```

## Security Architecture

### Token Flow

```
┌──────────────────────────────────────────────────────┐
│                  ID Token                             │
│  • User identity information                          │
│  • Name, email, UPN                                   │
│  • Not used for API authorization                     │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│                Access Token                           │
│  • Used for API authorization                         │
│  • Includes scopes and permissions                    │
│  • Short-lived (1 hour default)                       │
│  • Validated by backend                               │
│                                                        │
│  Header:                                              │
│  {                                                     │
│    "alg": "RS256",                                    │
│    "kid": "key-id",                                   │
│    "typ": "JWT"                                       │
│  }                                                     │
│                                                        │
│  Payload:                                             │
│  {                                                     │
│    "aud": "api-client-id",    // Audience             │
│    "iss": "https://login.../",// Issuer               │
│    "iat": 1234567890,         // Issued at            │
│    "exp": 1234571490,         // Expires              │
│    "oid": "user-object-id",   // User ID              │
│    "scp": "access_as_user",   // Scopes               │
│    ...                                                 │
│  }                                                     │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│                Refresh Token                          │
│  • Used to obtain new access tokens                   │
│  • Long-lived (days/weeks)                            │
│  • Managed automatically by MSAL                      │
│  • Revocable by user or admin                         │
└──────────────────────────────────────────────────────┘
```

### JWT Validation Process

```
┌─────────────────────────────────────────────────────┐
│          Backend Token Validation                    │
└─────────────────────────────────────────────────────┘
                      │
                      ▼
        ┌─────────────────────────┐
        │  1. Extract Bearer Token │
        │     from Authorization   │
        │     Header               │
        └────────────┬─────────────┘
                     │
                     ▼
        ┌─────────────────────────┐
        │  2. Decode Token Header  │
        │     Get Key ID (kid)     │
        └────────────┬─────────────┘
                     │
                     ▼
        ┌─────────────────────────┐
        │  3. Fetch JWKS from      │
        │     Microsoft Entra ID   │
        │     (Cached)             │
        └────────────┬─────────────┘
                     │
                     ▼
        ┌─────────────────────────┐
        │  4. Find Matching Key    │
        │     using kid            │
        └────────────┬─────────────┘
                     │
                     ▼
        ┌─────────────────────────┐
        │  5. Verify Signature     │
        │     using RS256          │
        └────────────┬─────────────┘
                     │
                     ▼
        ┌─────────────────────────┐
        │  6. Validate Claims      │
        │     • Audience (aud)     │
        │     • Issuer (iss)       │
        │     • Expiration (exp)   │
        │     • Not Before (nbf)   │
        └────────────┬─────────────┘
                     │
                     ▼
        ┌─────────────────────────┐
        │  7. Return User Info     │
        │     from Token Payload   │
        └─────────────────────────┘
```

## Deployment Architecture

### Azure Container Apps

```
┌─────────────────────────────────────────────────────────┐
│              Azure Container Apps Environment            │
│                                                           │
│  ┌──────────────────────┐    ┌──────────────────────┐  │
│  │  Frontend Container  │    │  Backend Container   │  │
│  │                      │    │                      │  │
│  │  • Nginx:alpine      │    │  • Python 3.11       │  │
│  │  • React SPA         │    │  • FastAPI           │  │
│  │  • Port 80           │    │  • Port 8000         │  │
│  │  • External Ingress  │    │  • External Ingress  │  │
│  │                      │    │                      │  │
│  │  CPU: 0.5            │    │  CPU: 0.5            │  │
│  │  Memory: 1Gi         │    │  Memory: 1Gi         │  │
│  │                      │    │                      │  │
│  │  Env Vars:           │    │  Env Vars:           │  │
│  │  • VITE_*            │    │  • ENTRA_*           │  │
│  │                      │    │  • ALLOWED_ORIGINS   │  │
│  └──────────────────────┘    └──────────────────────┘  │
│           │                            │                 │
│           │  HTTPS                     │  HTTPS          │
│           ▼                            ▼                 │
│  ┌────────────────────────────────────────────────┐    │
│  │         Azure Load Balancer / Ingress          │    │
│  │  • SSL/TLS Termination                         │    │
│  │  • Custom Domains                              │    │
│  │  • Auto-scaling                                │    │
│  └────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
                            │
                            │ HTTPS
                            ▼
                   ┌──────────────────┐
                   │  Azure Container │
                   │    Registry      │
                   │                  │
                   │  • Frontend img  │
                   │  • Backend img   │
                   └──────────────────┘
```

## Data Flow

### User Session Data

```
Browser (sessionStorage)
└── MSAL Cache
    ├── Access Token (1 hour TTL)
    ├── ID Token
    ├── Refresh Token
    └── Account Info
        ├── User ID (oid)
        ├── Email
        ├── Name
        └── Tenant ID
```

### API Request Headers

```
GET /api/user/profile HTTP/1.1
Host: backend.azurecontainerapps.io
Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGc...
Content-Type: application/json
Origin: https://frontend.azurecontainerapps.io
```

### API Response

```
HTTP/1.1 200 OK
Content-Type: application/json
Access-Control-Allow-Origin: https://frontend.azurecontainerapps.io
Access-Control-Allow-Credentials: true

{
  "user_id": "12345-67890-...",
  "email": "user@company.com",
  "name": "John Doe",
  "tenant_id": "tenant-id",
  "roles": []
}
```

## Security Layers

```
┌─────────────────────────────────────────────────────┐
│ Layer 1: Network Security                           │
│  • HTTPS Only                                        │
│  • Azure Load Balancer                              │
│  • DDoS Protection                                   │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│ Layer 2: Application Security                       │
│  • CORS Restrictions                                 │
│  • Security Headers                                  │
│  • Rate Limiting (planned)                           │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│ Layer 3: Authentication                              │
│  • Microsoft Entra ID                                │
│  • OAuth 2.0 / OIDC                                  │
│  • Multi-factor Authentication (if enabled)          │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│ Layer 4: Authorization                               │
│  • JWT Token Validation                              │
│  • Signature Verification                            │
│  • Claims Validation                                 │
│  • Scope Checking                                    │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│ Layer 5: Data Security                               │
│  • Encrypted in Transit (TLS)                        │
│  • Token Expiration                                  │
│  • sessionStorage (cleared on close)                 │
└─────────────────────────────────────────────────────┘
```

## Scalability

### Horizontal Scaling

```
                    Load Balancer
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
    Backend-1        Backend-2        Backend-3
     Instance         Instance         Instance
        │                │                │
        └────────────────┴────────────────┘
                         │
                    Shared Cache
                  (Future: Redis)
```

### Auto-scaling Configuration

```yaml
Container App Settings:
  minReplicas: 1
  maxReplicas: 10
  rules:
    - name: http-scaling
      type: http
      metadata:
        concurrentRequests: 100
```

## Monitoring & Observability

```
┌──────────────────────────────────────────────────────┐
│               Application Insights                    │
│  • Request tracking                                   │
│  • Exception logging                                  │
│  • Performance metrics                                │
│  • Custom events                                      │
└──────────────────────────────────────────────────────┘
                       ↑
                       │
        ┌──────────────┴──────────────┐
        │                             │
┌───────┴────────┐           ┌────────┴───────┐
│   Frontend     │           │    Backend     │
│   Logging      │           │    Logging     │
│                │           │                │
│ • MSAL events  │           │ • Auth events  │
│ • API calls    │           │ • API requests │
│ • Errors       │           │ • JWT errors   │
└────────────────┘           └────────────────┘
```

## Summary

This architecture provides:
- ✅ **Secure authentication** with Microsoft Entra ID
- ✅ **Scalable deployment** on Azure Container Apps
- ✅ **Token-based authorization** with JWT
- ✅ **Separation of concerns** (frontend/backend)
- ✅ **Production-ready** with monitoring and security
- ✅ **Cloud-native** design patterns
