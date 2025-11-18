# Dashboard Architecture Overview

## Component Hierarchy

```
App.tsx (ThemeProvider + CssBaseline)
│
├── Routes
│   ├── /login → LoginPage
│   │
│   └── ProtectedRoute (authentication guard)
│       │
│       └── MainLayout (sidebar + content area)
│           │
│           ├── Sidebar Navigation (260px)
│           │   ├── Logo Placeholder
│           │   ├── Dashboard Link
│           │   ├── Chatbot Link
│           │   ├── Settings Link
│           │   └── User Profile
│           │       ├── Avatar
│           │       ├── Name
│           │       ├── Email
│           │       └── Sign Out Button
│           │
│           └── Main Content Area
│               │
│               ├── /dashboard → DashboardPage
│               │   │
│               │   ├── KPI Section (5 cards)
│               │   │   ├── KPICard: Total Calls
│               │   │   ├── KPICard: Avg Handling Time
│               │   │   ├── KPICard: Customer Satisfaction
│               │   │   ├── KPICard: Agent Availability
│               │   │   └── KPICard: Escalation Rate
│               │   │
│               │   └── Charts Section (4 charts)
│               │       ├── Call Volume Trend (AreaChart)
│               │       ├── Satisfaction Breakdown (PieChart)
│               │       ├── Calls by Hour (BarChart)
│               │       └── Agent Performance (BarChart)
│               │
│               ├── /chatbot → ChatbotPage (placeholder)
│               │
│               └── /settings → SettingsPage (placeholder)
```

## Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser                               │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  React Application (Port 3000)                      │    │
│  │                                                      │    │
│  │  ┌──────────────────────────────────────────────┐  │    │
│  │  │  DashboardPage Component                      │  │    │
│  │  │                                                │  │    │
│  │  │  useEffect(() => {                            │  │    │
│  │  │    fetchKPIs();      ─────────────┐           │  │    │
│  │  │    fetchChartData(); ─────────────┼──┐        │  │    │
│  │  │  }, []);                          │  │        │  │    │
│  │  └────────────────────────────────────┼──┼────────┘  │    │
│  │                                       │  │           │    │
│  │  ┌────────────────────────────────────▼──▼────────┐  │    │
│  │  │  apiClient.ts (Axios)                          │  │    │
│  │  │  - Intercepts requests                         │  │    │
│  │  │  - Adds JWT Bearer token                       │  │    │
│  │  │  - Handles token refresh                       │  │    │
│  │  └─────────────────────┬──────────────────────────┘  │    │
│  └────────────────────────┼─────────────────────────────┘    │
│                           │                                   │
└───────────────────────────┼───────────────────────────────────┘
                            │ HTTP Requests
                            │ Authorization: Bearer <JWT>
                            │
┌───────────────────────────▼───────────────────────────────────┐
│                    FastAPI Backend (Port 8000)                │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  JWT Validation Middleware                               │ │
│  │  - Verifies token signature with JWKS                    │ │
│  │  - Checks expiration                                     │ │
│  │  - Extracts user claims                                  │ │
│  └────────────────────────┬─────────────────────────────────┘ │
│                           │                                    │
│  ┌────────────────────────▼─────────────────────────────────┐ │
│  │  Protected Endpoints                                      │ │
│  │                                                            │ │
│  │  GET /api/dashboard/kpis                                 │ │
│  │  └─> Returns: {                                          │ │
│  │        totalCalls: 1543,                                 │ │
│  │        avgHandlingTime: "5:32",                          │ │
│  │        customerSatisfaction: 4.5,                        │ │
│  │        agentAvailability: 87,                            │ │
│  │        escalationRate: 12.3                              │ │
│  │      }                                                    │ │
│  │                                                            │ │
│  │  GET /api/dashboard/charts                               │ │
│  │  └─> Returns: {                                          │ │
│  │        callVolumeTrend: [...],    // 7 days             │ │
│  │        callsByHour: [...],        // 10 hours           │ │
│  │        satisfactionBreakdown: [...], // 5 ratings       │ │
│  │        agentPerformance: [...]    // 5 agents           │ │
│  │      }                                                    │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                                │
│  Future: Connect to Real Database                             │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  CosmosDB / SQL / PostgreSQL                             │ │
│  │  - Call center transaction data                          │ │
│  │  - Agent performance metrics                             │ │
│  │  - Customer satisfaction scores                          │ │
│  └──────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

## Authentication Flow

```
┌──────────────┐
│   Browser    │
│  (Not signed │
│      in)     │
└──────┬───────┘
       │
       │ Navigate to /dashboard
       ▼
┌────────────────────┐
│  ProtectedRoute    │
│  - Checks accounts │
│  - No user found   │
└──────┬─────────────┘
       │
       │ <Navigate to="/login">
       ▼
┌─────────────────────────────┐
│     LoginPage Component      │
│  ┌─────────────────────────┐│
│  │ Sign in with Microsoft  ││
│  │       [Button]          ││
│  └───────────┬─────────────┘│
└──────────────┼──────────────┘
               │
               │ loginRedirect()
               ▼
┌────────────────────────────────────────┐
│    Microsoft Entra ID (Azure AD)       │
│  - User enters credentials             │
│  - Multi-factor authentication (if set)│
│  - Grants consent                      │
└──────────────┬─────────────────────────┘
               │
               │ Redirect with auth code
               ▼
┌────────────────────────────────────────┐
│    MSAL.js (main.tsx)                  │
│  - handleRedirectPromise()             │
│  - Exchanges code for tokens           │
│  - Stores in browser (session)         │
│  ┌──────────────────────────────────┐  │
│  │ Tokens:                          │  │
│  │ - ID Token (user identity)       │  │
│  │ - Access Token (API access)      │  │
│  │ - Refresh Token (get new tokens) │  │
│  └──────────────────────────────────┘  │
└──────────────┬─────────────────────────┘
               │
               │ User now authenticated
               ▼
┌────────────────────────────────────────┐
│      ProtectedRoute (re-check)         │
│  - Checks accounts                     │
│  - User found ✓                        │
│  - Renders children                    │
└──────────────┬─────────────────────────┘
               │
               ▼
┌────────────────────────────────────────┐
│         Dashboard Displayed            │
│  - User sees KPIs and charts           │
│  - All API calls include JWT token     │
└────────────────────────────────────────┘
```

## File Structure

```
e2e-call-center-ai-insights/
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── LoginPage.tsx           [Microsoft login UI]
│   │   │   ├── ProtectedRoute.tsx      [Auth guard wrapper]
│   │   │   ├── MainLayout.tsx          [Sidebar + content layout]
│   │   │   ├── KPICard.tsx             [Reusable KPI component]
│   │   │   ├── DashboardPage.tsx       [Main dashboard with KPIs + charts]
│   │   │   ├── ChatbotPage.tsx         [Placeholder]
│   │   │   ├── SettingsPage.tsx        [Placeholder]
│   │   │   └── Dashboard.old.tsx       [Original - preserved]
│   │   │
│   │   ├── theme/
│   │   │   └── theme.ts                [Material-UI theme + white-labeling]
│   │   │
│   │   ├── services/
│   │   │   └── apiClient.ts            [Axios with JWT interceptor]
│   │   │
│   │   ├── authConfig.ts               [MSAL configuration]
│   │   ├── main.tsx                    [App entry + MSAL provider]
│   │   └── App.tsx                     [Routing + theme provider]
│   │
│   └── package.json                    [Dependencies: React, MSAL, MUI, Recharts]
│
├── backend/
│   ├── main.py                         [FastAPI app + endpoints]
│   ├── config.py                       [Environment config]
│   └── requirements.txt                [Python dependencies]
│
├── prompts/
│   ├── 1-sso.md                        [SSO implementation context]
│   ├── 2-dashboard-implementation.md   [This implementation docs]
│   └── 3-chatbot.md                    [Chatbot requirements]
│
├── QUICK-START.md                      [Testing guide]
├── DASHBOARD-CHECKLIST.md              [Implementation checklist]
└── ARCHITECTURE-OVERVIEW.md            [This file]
```

## Technology Stack

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.2.0 | UI framework |
| TypeScript | 5.3.3 | Type safety |
| Vite | 5.0.8 | Build tool |
| Material-UI | 5.15.0 | Component library |
| Recharts | 2.10.3 | Chart library |
| MSAL.js | 3.7.1 | Microsoft authentication |
| React Router | 6.20.0 | Routing |
| Axios | 1.6.2 | HTTP client |
| Emotion | 11.11.x | CSS-in-JS styling |

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| FastAPI | 0.109.0 | API framework |
| Python | 3.9+ | Runtime |
| Python-JOSE | 3.3.0 | JWT validation |
| Pydantic | 2.5.3 | Data validation |
| Uvicorn | 0.25.0 | ASGI server |

### Infrastructure (Planned)
| Technology | Purpose |
|------------|---------|
| Azure Container Apps | Application hosting |
| Azure Entra ID | Authentication provider |
| Azure Cosmos DB | Database (recommended) |
| Azure Application Insights | Monitoring |
| Docker | Containerization |

## Component Responsibilities

### Frontend Components

#### `App.tsx`
- **Purpose:** Application root and routing configuration
- **Key Features:**
  - Theme provider initialization
  - Tenant configuration loading
  - Route definitions
  - Protected route wrapping

#### `MainLayout.tsx`
- **Purpose:** Application shell with navigation
- **Key Features:**
  - Collapsible sidebar (260px)
  - Navigation menu
  - User profile section
  - Responsive drawer (mobile + desktop)
  - Sign out functionality

#### `DashboardPage.tsx`
- **Purpose:** Main dashboard view
- **Key Features:**
  - 5 KPI cards display
  - 4 chart visualizations
  - API data fetching
  - Loading and error states
  - Responsive grid layout

#### `KPICard.tsx`
- **Purpose:** Reusable KPI metric display
- **Key Features:**
  - Configurable icon and color
  - Trend indicator
  - Loading skeleton
  - Responsive design

#### `ProtectedRoute.tsx`
- **Purpose:** Authentication guard
- **Key Features:**
  - Checks user authentication
  - Handles loading states
  - Redirects to login if needed

#### `LoginPage.tsx`
- **Purpose:** Microsoft authentication entry
- **Key Features:**
  - Microsoft sign-in button
  - Loading state during auth
  - Auto-redirect if authenticated

### Backend Endpoints

#### `GET /api/dashboard/kpis`
- **Auth:** Required (JWT Bearer token)
- **Purpose:** Fetch key performance indicators
- **Returns:**
  ```json
  {
    "totalCalls": 1543,
    "avgHandlingTime": "5:32",
    "customerSatisfaction": 4.5,
    "agentAvailability": 87,
    "escalationRate": 12.3
  }
  ```

#### `GET /api/dashboard/charts`
- **Auth:** Required (JWT Bearer token)
- **Purpose:** Fetch chart visualization data
- **Returns:**
  ```json
  {
    "callVolumeTrend": [
      { "date": "2024-01-01", "calls": 245 },
      ...
    ],
    "callsByHour": [
      { "hour": "09:00", "calls": 123 },
      ...
    ],
    "satisfactionBreakdown": [
      { "rating": "5 stars", "value": 45 },
      ...
    ],
    "agentPerformance": [
      {
        "name": "Sarah Johnson",
        "calls": 234,
        "avgHandling": 4.5,
        "satisfaction": 4.8
      },
      ...
    ]
  }
  ```

#### `GET /api/user/profile`
- **Auth:** Required (JWT Bearer token)
- **Purpose:** Fetch current user profile
- **Returns:** User data from JWT token claims

#### `GET /health`
- **Auth:** Not required (public)
- **Purpose:** Health check endpoint
- **Returns:** `{"status": "healthy"}`

## State Management

### Current Approach: React Hooks
```typescript
// Component-level state
const [kpiData, setKpiData] = useState<KPIData | null>(null);
const [chartData, setChartData] = useState<ChartData | null>(null);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

// Theme/tenant state (App level)
const [tenantConfig, setTenantConfig] = useState<TenantConfig>(defaultTenantConfig);
const [theme, setTheme] = useState(createAppTheme(defaultTenantConfig));
```

### Future Recommendations:
- **React Query / TanStack Query** for server state
  - Automatic caching
  - Background refetching
  - Optimistic updates
  - Retry logic
  
- **Zustand / Redux** for global client state
  - User preferences
  - UI state (sidebar collapsed)
  - Notification queue

## Performance Considerations

### Current Optimizations:
✅ Lazy imports possible with React.lazy()
✅ Material-UI tree shaking
✅ Vite fast HMR (Hot Module Replacement)
✅ TypeScript compile-time checks

### Recommended Future Optimizations:
- [ ] Code splitting by route
- [ ] Image optimization
- [ ] Service worker for offline support
- [ ] React.memo for expensive components
- [ ] useMemo for expensive calculations
- [ ] Virtualization for large lists (react-window)
- [ ] CDN for static assets
- [ ] HTTP/2 push for critical resources

## Security Considerations

### Current Security Measures:
✅ JWT token validation with JWKS
✅ HTTPS in production (recommended)
✅ CORS configuration
✅ Protected routes on frontend
✅ Protected endpoints on backend
✅ Token stored in memory (not localStorage)
✅ Token expiration checking

### Recommended Additional Measures:
- [ ] Rate limiting on API endpoints
- [ ] Input validation and sanitization
- [ ] XSS protection headers
- [ ] CSRF tokens for state-changing operations
- [ ] Content Security Policy (CSP)
- [ ] Regular dependency updates
- [ ] Security headers (Helmet.js)
- [ ] Audit logging
- [ ] IP allowlisting (if applicable)

## Accessibility (A11y)

### Current Features:
✅ Material-UI built-in accessibility
✅ Semantic HTML
✅ Keyboard navigation support
✅ ARIA labels from MUI components

### Recommended Enhancements:
- [ ] Alt text for all visual elements
- [ ] Skip navigation links
- [ ] Color contrast verification (WCAG AA)
- [ ] Screen reader testing
- [ ] Focus indicator customization
- [ ] Reduced motion support
- [ ] ARIA live regions for dynamic content

## Testing Strategy (Recommended)

### Unit Tests
```typescript
// Component tests with React Testing Library
describe('KPICard', () => {
  it('displays value and trend correctly', () => {
    render(<KPICard title="Test" value="100" trend={5} />);
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('+5%')).toBeInTheDocument();
  });
});

// API endpoint tests with pytest
def test_get_kpis_authenticated(client, auth_headers):
    response = client.get("/api/dashboard/kpis", headers=auth_headers)
    assert response.status_code == 200
    assert "totalCalls" in response.json()
```

### Integration Tests
- Authentication flow end-to-end
- Dashboard data loading
- Navigation between pages
- API integration

### E2E Tests (Playwright/Cypress)
- User login journey
- Dashboard interaction
- Charts rendering
- Responsive design

## Deployment Architecture

### Current (Development):
```
[Browser] ←→ [Vite Dev Server :3000] ←→ [FastAPI :8000]
                                          ↓
                                    [Azure Entra ID]
```

### Production (Planned):
```
[User]
  ↓
[Azure Front Door / CDN]
  ↓
[Azure Container Apps]
  ├─→ [Frontend Container] (nginx serving static files)
  └─→ [Backend Container] (FastAPI)
        ↓
  [Azure Cosmos DB]
        ↓
  [Azure Entra ID]
```

## Monitoring & Observability (Planned)

### Metrics to Track:
- API response times
- Error rates
- Authentication failures
- Chart render performance
- User sessions
- API call frequency
- Database query performance

### Tools:
- Azure Application Insights
- Azure Monitor
- Custom logging in backend
- Browser performance API
- Real User Monitoring (RUM)

## Future Enhancements

### Phase 2: Real Data Integration
- Connect to actual call center database
- Implement data aggregation queries
- Add caching layer
- Real-time updates via WebSocket

### Phase 3: Advanced Features
- Drill-down capabilities
- Export to PDF/CSV
- Custom date range selection
- Advanced filtering
- Saved views / bookmarks
- User preferences

### Phase 4: Analytics
- Predictive analytics
- Anomaly detection
- Trend forecasting
- Agent performance insights
- Customer sentiment analysis

### Phase 5: Multi-tenancy
- Tenant isolation
- Tenant-specific branding
- Tenant administration
- Usage metrics per tenant

---

This architecture supports:
- ✅ Scalability (horizontal scaling with containers)
- ✅ Security (JWT auth, protected routes)
- ✅ Maintainability (modular components, TypeScript)
- ✅ Extensibility (plugin new features easily)
- ✅ Performance (optimized rendering, lazy loading ready)
- ✅ User Experience (responsive, accessible, intuitive)
