"""
FastAPI backend with Microsoft Entra ID (Azure AD) authentication.
Uses JWT token validation to secure API endpoints.
"""
import os
import ssl

# CRITICAL: Configure SSL verification BEFORE any imports that use SSL
# This must happen before Settings, MSAL, or any Azure SDK imports
if os.getenv("DISABLE_SSL_VERIFY", "false").lower() == "true":
    print("⚠️  SSL VERIFICATION GLOBALLY DISABLED - Development mode only!")
    print("⚠️  This affects MSAL, httpx, and all SSL connections")
    ssl._create_default_https_context = ssl._create_unverified_context

from fastapi import FastAPI, Depends, HTTPException, status, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional, Dict, List
import httpx
import logging
from jose import jwt, JWTError
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import time
import hashlib

# Configure Azure SDK logging to be less verbose
logging.getLogger("azure.core.pipeline.policies.http_logging_policy").setLevel(logging.WARNING)
logging.getLogger("azure.cosmos").setLevel(logging.WARNING)
logging.getLogger("azure.identity").setLevel(logging.WARNING)
from functools import lru_cache
from datetime import datetime
from config import Settings
from models import (
    QueryTemplate,
    QueryTemplateCreate,
    QueryTemplateUpdate,
    QueryTemplateList
)
from chat_models import (
    ChatConversation,
    ConversationSummary,
    ChatMessage,
    MessageSender,
    CreateConversationRequest,
    AddMessageRequest
)
import uuid

from cosmos_service import CosmosDBService
from copilot_studio_service import CopilotStudioService
from ai_foundry_service import AIFoundryService
from conversation_service import ConversationService
from powerbi_service import PowerBIService
from visualization_service import visualization_service
from rbac_service import RBACService
from fabric_lakehouse_service import FabricLakehouseService
from rbac_models import (
    Permission,
    UserPermissions,
    RoleDefinition,
    CreateRoleRequest,
    UpdateRoleRequest,
    AssignRoleRequest
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize rate limiter
limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])

# Initialize FastAPI app
app = FastAPI(title="Call Center AI Insights API")

# Add rate limiter to app state
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# In-memory storage for query templates (replace with database in production)
query_templates_db: Dict[str, QueryTemplate] = {}

# Security scheme
security = HTTPBearer()

# Global service instances
cosmos_service: Optional[CosmosDBService] = None
copilot_studio_service: Optional[CopilotStudioService] = None
ai_foundry_service: Optional[AIFoundryService] = None
conversation_service: Optional[ConversationService] = None
powerbi_service: Optional[PowerBIService] = None
rbac_service: Optional[RBACService] = None
fabric_service: Optional[FabricLakehouseService] = None

# Cached settings
@lru_cache()
def get_settings():
    return Settings()

@app.on_event("startup")
async def startup_event():
    """Initialize services on startup."""
    global cosmos_service, copilot_studio_service, ai_foundry_service, conversation_service, powerbi_service, fabric_service
    settings = get_settings()
    
    # Initialize Cosmos DB service if account URI is provided
    if settings.COSMOS_DB_ACCOUNT_URI:
        logger.info("Initializing Cosmos DB service...")
        cosmos_service = CosmosDBService(settings)
        try:
            await cosmos_service.initialize()
            logger.info("✓ Cosmos DB service initialized successfully")
        except Exception as e:
            logger.error(f"❌ Failed to initialize Cosmos DB service: {type(e).__name__}: {e}")
            cosmos_service = None
    else:
        logger.warning("⚠ Cosmos DB account URI not configured - service will not be available")
    
    # Initialize Copilot Studio service if configured
    if settings.copilot_studio:
        try:
            copilot_studio_service = CopilotStudioService(settings, visualization_service)
            logger.info("✓ Copilot Studio service initialized with visualization support")
        except Exception as e:
            logger.error(f"Failed to initialize Copilot Studio service: {e}")
            copilot_studio_service = None
    
    # Initialize Azure AI Foundry service if configured
    if settings.ai_foundry:
        try:
            ai_foundry_service = AIFoundryService(settings, visualization_service)
            logger.info("✓ Azure AI Foundry service initialized with visualization support")
        except Exception as e:
            logger.error(f"Failed to initialize Azure AI Foundry service: {e}")
            ai_foundry_service = None
    
    # Initialize Power BI service if configured
    if settings.powerbi:
        try:
            powerbi_service = PowerBIService(
                tenant_id=settings.powerbi.tenant_id,
                client_id=settings.powerbi.client_id,
                client_secret=settings.powerbi.client_secret,
                workspace_id=settings.powerbi.workspace_id,
                report_id=settings.powerbi.report_id,
                use_service_principal=settings.powerbi.use_service_principal
            )
            auth_mode = "Service Principal" if settings.powerbi.use_service_principal else "OBO flow"
            logger.info(f"✓ Power BI service initialized with {auth_mode}")
        except Exception as e:
            logger.error(f"Failed to initialize Power BI service: {e}")
            powerbi_service = None
    
    # Initialize conversation service (works with or without Cosmos)
    conversation_service = ConversationService(cosmos_service)
    
    # Initialize RBAC service
    global rbac_service
    rbac_service = RBACService(cosmos_service)
    logger.info("✓ RBAC service initialized")
    
    # Initialize Fabric Lakehouse service if configured
    if settings.fabric_lakehouse and settings.fabric_lakehouse.is_configured():
        try:
            fabric_service = FabricLakehouseService(settings.fabric_lakehouse)
            # Test connection
            if await fabric_service.test_connection():
                logger.info("✓ Fabric Lakehouse service initialized and connection tested")
            else:
                logger.warning("⚠ Fabric Lakehouse service initialized but connection test failed")
        except Exception as e:
            logger.error(f"Failed to initialize Fabric Lakehouse service: {e}")
            fabric_service = None
    else:
        logger.info("ℹ Fabric Lakehouse not configured - dashboard will use mock data")
        fabric_service = None

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown."""
    global cosmos_service, fabric_service
    if cosmos_service:
        await cosmos_service.close()
    if fabric_service:
        fabric_service.close()

# CORS configuration
settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security headers middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    """Add security headers to all responses."""
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Content-Security-Policy"] = "default-src 'self'; frame-ancestors 'none';"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    return response

# Audit logging middleware
@app.middleware("http")
async def audit_middleware(request: Request, call_next):
    """Log all API requests for audit purposes."""
    start_time = time.time()
    
    # Extract user info from token if present
    auth_header = request.headers.get("authorization", "")
    user_id = "anonymous"
    user_email = "anonymous"
    
    if auth_header.startswith("Bearer "):
        try:
            token = auth_header.split(" ")[1]
            payload = jwt.get_unverified_claims(token)
            user_id = payload.get("oid", "unknown")
            user_email = payload.get("preferred_username") or payload.get("email", "unknown")
        except:
            pass
    
    # Process request
    response = await call_next(request)
    
    # Calculate duration
    duration_ms = (time.time() - start_time) * 1000
    
    # Log the request
    logger.info(
        f"API_AUDIT: {request.method} {request.url.path} - "
        f"User: {user_email} ({user_id}) - "
        f"IP: {request.client.host if request.client else 'unknown'} - "
        f"Status: {response.status_code} - "
        f"Duration: {duration_ms:.2f}ms"
    )
    
    return response

# Cache for JWKS (JSON Web Key Set)
_jwks_cache: Optional[Dict] = None

# Token validation cache (to reduce JWT validation overhead)
from cachetools import TTLCache
_token_validation_cache = TTLCache(maxsize=1000, ttl=300)  # 5 minute TTL

async def get_jwks() -> Dict:
    """
    Fetch JSON Web Key Set from Microsoft Entra ID.
    Implements caching to reduce external calls.
    """
    global _jwks_cache
    
    if _jwks_cache is not None:
        return _jwks_cache
    
    settings = get_settings()
    jwks_url = f"https://login.microsoftonline.com/{settings.ENTRA_TENANT_ID}/discovery/v2.0/keys"
    
    # Check if SSL verification should be disabled
    verify_ssl = not settings.DISABLE_SSL_VERIFY
    
    try:
        async with httpx.AsyncClient(verify=verify_ssl) as client:
            response = await client.get(jwks_url, timeout=10.0)
            response.raise_for_status()
            _jwks_cache = response.json()
            return _jwks_cache
    except Exception as e:
        logger.error(f"Failed to fetch JWKS: {e}")
        if "CERTIFICATE_VERIFY_FAILED" in str(e) or "certificate" in str(e).lower():
            logger.error("💡 SSL certificate error detected. If behind a corporate proxy, set DISABLE_SSL_VERIFY=true in .env")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch signing keys"
        )

async def verify_token(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> Dict:
    """
    Verify JWT access token from Microsoft Entra ID with caching.
    
    Steps:
    1. Check cache for previously validated token
    2. Extract token from Authorization header
    3. Fetch JWKS from Microsoft
    4. Validate token signature and claims
    5. Cache validation result
    6. Return decoded token payload
    """
    token = credentials.credentials
    settings = get_settings()
    
    # Check cache first
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    if token_hash in _token_validation_cache:
        logger.debug("Token validation cache hit")
        return _token_validation_cache[token_hash]
    
    try:
        # Get signing keys
        jwks = await get_jwks()
        
        # Decode token header to get the key ID
        unverified_header = jwt.get_unverified_header(token)
        
        # Find the correct signing key
        rsa_key = None
        for key in jwks.get("keys", []):
            if key["kid"] == unverified_header["kid"]:
                rsa_key = {
                    "kty": key["kty"],
                    "kid": key["kid"],
                    "use": key["use"],
                    "n": key["n"],
                    "e": key["e"]
                }
                break
        
        if rsa_key is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Unable to find appropriate signing key"
            )
        
        # First, decode without verification to see what's in the token
        unverified_payload = jwt.get_unverified_claims(token)
        
        # Accept both v1.0 and v2.0 token issuers
        v1_issuer = f"https://sts.windows.net/{settings.ENTRA_TENANT_ID}/"
        v2_issuer = f"https://login.microsoftonline.com/{settings.ENTRA_TENANT_ID}/v2.0"
        
        # Determine which issuer to use based on the token
        token_issuer = unverified_payload.get('iss')
        expected_issuer = v1_issuer if token_issuer == v1_issuer else v2_issuer
        
        # Try to decode with the api:// prefixed audience first
        api_audience = f"api://{settings.ENTRA_CLIENT_ID}"
        
        try:
            # Try with api:// prefix first (most common for exposed APIs)
            payload = jwt.decode(
                token,
                rsa_key,
                algorithms=["RS256"],
                audience=api_audience,
                issuer=expected_issuer
            )
        except JWTError as e:
            # Fallback to client ID without prefix
            payload = jwt.decode(
                token,
                rsa_key,
                algorithms=["RS256"],
                audience=settings.ENTRA_CLIENT_ID,
                issuer=expected_issuer
            )
        
        # Cache the validated token
        _token_validation_cache[token_hash] = payload
        logger.debug("Token validated and cached")
        
        return payload
        
    except JWTError as e:
        logger.error(f"JWT validation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid authentication credentials: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:
        logger.error(f"Token verification error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials"
        )

# RBAC helper functions
async def get_user_permissions(token_payload: Dict = Depends(verify_token)) -> UserPermissions:
    """
    Get user permissions from token payload.
    This is a dependency that can be used in endpoints.
    Raises 403 if user has no roles assigned.
    """
    settings = get_settings()
    
    # Development mode: Bypass RBAC if DISABLE_RBAC is true
    if settings.DISABLE_RBAC:
        logger.warning("⚠️  RBAC DISABLED - Development mode: Granting Administrator role to all authenticated users")
        from rbac_models import Permission
        return UserPermissions(
            user_id=token_payload.get("oid", "unknown"),
            user_email=token_payload.get("preferred_username") or token_payload.get("email", "unknown"),
            roles=["Administrator"],  # Grant admin role
            permissions=list(Permission),  # All permissions
            is_administrator=True
        )
    
    if not rbac_service:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="RBAC service not initialized"
        )
    
    user_permissions = await rbac_service.get_user_permissions(token_payload)
    
    # Debug logging
    logger.info(f"DEBUG: User {user_permissions.user_email} has roles: {user_permissions.roles}")
    
    # Check if user has any VALID APP ROLES (not just OAuth scopes like 'access_as_user')
    valid_app_roles = {"Administrator", "Contributor", "Reader"}
    user_app_roles = set(user_permissions.roles) & valid_app_roles
    
    if not user_app_roles:
        logger.warning(f"Access denied for user {user_permissions.user_email}: No valid app roles assigned (has: {user_permissions.roles})")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You do not have any assigned roles. Please contact your administrator to request access."
        )
    
    return user_permissions

def require_permission(required_permission: Permission):
    """
    Dependency factory to require specific permission.
    Usage: permissions: UserPermissions = Depends(require_permission(Permission.DASHBOARD_VIEW))
    """
    async def permission_checker(user_permissions: UserPermissions = Depends(get_user_permissions)):
        if not rbac_service.has_permission(user_permissions, required_permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions. Required: {required_permission.value}"
            )
        return user_permissions
    return permission_checker

def require_any_permission(required_permissions: List[Permission]):
    """
    Dependency factory to require any of the specified permissions.
    """
    async def permission_checker(user_permissions: UserPermissions = Depends(get_user_permissions)):
        if not rbac_service.has_any_permission(user_permissions, required_permissions):
            required = [p.value for p in required_permissions]
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions. Required one of: {required}"
            )
        return user_permissions
    return permission_checker

def require_admin():
    """Dependency to require administrator role."""
    async def admin_checker(user_permissions: UserPermissions = Depends(get_user_permissions)):
        if not user_permissions.is_administrator:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Administrator privileges required"
            )
        return user_permissions
    return admin_checker

# Health check endpoint (public)
@app.get("/health")
async def health_check():
    """Public health check endpoint."""
    health_status = {"status": "healthy", "services": {}}
    
    # Check Cosmos DB if configured
    if cosmos_service:
        try:
            cosmos_health = await cosmos_service.health_check()
            health_status["services"]["cosmos_db"] = cosmos_health
            if cosmos_health["status"] != "healthy":
                health_status["status"] = "degraded"
        except Exception as e:
            health_status["services"]["cosmos_db"] = {
                "status": "unhealthy",
                "error": str(e)
            }
            health_status["status"] = "degraded"
    
    return health_status

@app.get("/api/config/ui")
async def get_ui_config(user_permissions: UserPermissions = Depends(get_user_permissions)):
    """
    Protected endpoint to get UI configuration.
    Returns tab configuration with environment-specific overrides applied.
    Requires authentication and at least one app role (Reader, Contributor, or Administrator).
    Users without any assigned role will receive 403 Forbidden.
    """
    return settings.ui_config.get_api_response()


@app.get("/api/config/visualization-instructions")
async def get_visualization_instructions(token_payload: Dict = Depends(verify_token)):
    """
    Protected endpoint to get agent instructions for generating visualizations.
    Returns markdown-formatted instructions for agents.
    Requires authentication.
    """
    from visualization_service import VisualizationService
    return {
        "instructions": VisualizationService.get_agent_instructions(),
        "enabled": True,
        "supported_libraries": ["matplotlib", "numpy", "pandas"]
    }


# Legacy endpoint for backwards compatibility
@app.get("/api/config/features")
async def get_feature_config():
    """
    DEPRECATED: Use /api/config/ui instead.
    Legacy endpoint for feature configuration.
    """
    # Map new UI config to old format for backwards compatibility
    ui_config = settings.ui_config
    
    tab_map = {
        "dashboard": "dashboard",
        "copilot-studio": "copilotStudio",
        "ai-foundry": "aiFoundry",
        "powerbi": "powerbi",
        "powerbi-reports": "powerbiReports",
        "settings": "settings"
    }
    
    features = {}
    for tab in ui_config.get_all_tabs():
        legacy_id = tab_map.get(tab.id)
        if legacy_id:
            features[legacy_id] = {
                "enabled": tab.display,
                "displayName": tab.labels.name
            }
    
    return {"features": features}

# Protected endpoints
@app.get("/api/user/profile")
async def get_user_profile(token_payload: Dict = Depends(verify_token)):
    """
    Get user profile information from the validated token.
    This endpoint is protected and requires valid authentication.
    """
    return {
        "user_id": token_payload.get("oid"),  # Object ID
        "email": token_payload.get("preferred_username") or token_payload.get("email"),
        "name": token_payload.get("name"),
        "tenant_id": token_payload.get("tid"),
        "roles": token_payload.get("roles", []),
    }

@app.get("/api/dashboard/kpis")
async def get_dashboard_kpis(
    user_permissions: UserPermissions = Depends(require_permission(Permission.DASHBOARD_VIEW))
):
    """
    Get dashboard KPI data with full configuration (protected endpoint).
    Returns KPI configuration including title, subtitle, icon, value, and trend.
    Backend determines all display properties allowing dynamic updates.
    Requires: DASHBOARD_VIEW permission
    
    Data Source: Microsoft Fabric Lakehouse - CurrentKPI table
    Fetches all KPIs for today's date in a single query
    """
    
    # Default mock KPIs (used if Fabric service is unavailable)
    default_kpis = [
        {
            "id": "total-calls",
            "title": "Total Call Volume",
            "subtitle": "Total calls today",
            "icon": "Phone",
            "color": "primary.main",
            "value": "1,543",
            "rawValue": 1543,
            "trend": {"value": 8.5, "isPositive": True},
            "order": 1
        },
        {
            "id": "avg-handling-time",
            "title": "Avg Handling Time",
            "subtitle": "Minutes per call",
            "icon": "AccessTime",
            "color": "info.main",
            "value": "5:32",
            "rawValue": 332,
            "trend": {"value": 3.2, "isPositive": False},
            "order": 2
        },
        {
            "id": "customer-satisfaction",
            "title": "Customer Satisfaction",
            "subtitle": "Average rating",
            "icon": "SentimentSatisfied",
            "color": "success.main",
            "value": "4.5/5",
            "rawValue": 4.5,
            "trend": {"value": 5.1, "isPositive": True},
            "order": 3
        },
        {
            "id": "agent-availability",
            "title": "Agent Availability",
            "subtitle": "Currently available",
            "icon": "People",
            "color": "warning.main",
            "value": "87%",
            "rawValue": 87,
            "trend": {"value": 2.3, "isPositive": True},
            "order": 4
        },
        {
            "id": "escalation-rate",
            "title": "Escalation Rate",
            "subtitle": "Escalated to supervisor",
            "icon": "TrendingUp",
            "color": "error.main",
            "value": "12.3%",
            "rawValue": 12.3,
            "trend": {"value": 1.8, "isPositive": False},
            "order": 5
        }
    ]
    
    # If Fabric service is available, fetch real data from CurrentKPI table
    if fabric_service:
        try:
            logger.info("Fetching KPIs from Fabric Lakehouse CurrentKPI table...")
            # Single query to fetch all KPIs for today
            # Since we're connected to a specific lakehouse database, we can reference tables directly
            query = """
            SELECT 
                icon,
                title,
                subtitle,
                value,
                rawValue,
                trend,
                trend_isPositive,
                display_order,
                color
            FROM currentkpi
            WHERE CAST(kpiDate AS DATE) = CAST(GETDATE() AS DATE)
            ORDER BY display_order ASC
            """
            
            results = await fabric_service.execute_query(query)
            logger.info(f"Fabric query returned {len(results) if results else 0} rows")
            
            if results and len(results) > 0:
                logger.info(f"Processing {len(results)} KPI rows from Fabric Lakehouse")
                # Transform database results to API format
                kpis = []
                for row in results:
                    # Generate ID from title (convert to kebab-case)
                    kpi_id = row.get('title', '').lower().replace(' ', '-')
                    
                    kpi = {
                        "id": kpi_id,
                        "title": row.get('title', ''),
                        "subtitle": row.get('subtitle', ''),
                        "icon": row.get('icon', ''),
                        "color": row.get('color', 'primary.main'),
                        "value": row.get('value', ''),
                        "rawValue": float(row.get('rawValue', 0)),
                        "trend": {
                            "value": float(row.get('trend', 0)),
                            "isPositive": bool(row.get('trend_isPositive', True))
                        },
                        "order": int(row.get('display_order', 0))
                    }
                    kpis.append(kpi)
                
                logger.info(f"Dashboard KPIs fetched from Fabric Lakehouse CurrentKPI table: {len(kpis)} KPIs")
                return {"kpis": kpis}
            else:
                logger.warning("No KPI data found in CurrentKPI table for today, using mock data")
                
        except Exception as e:
            logger.error(f"Error fetching KPIs from Fabric CurrentKPI table: {e}")
            logger.info("Using mock data as fallback")
    else:
        logger.debug("Fabric service not available, using mock data")
    
    # Return default mock data as fallback
    return {"kpis": default_kpis}

@app.get("/api/dashboard/charts")
async def get_dashboard_charts(
    user_permissions: UserPermissions = Depends(require_permission(Permission.DASHBOARD_VIEW))
):
    """
    Get dashboard chart data (protected endpoint).
    Returns mock data for charts and visualizations.
    Requires: DASHBOARD_VIEW permission
    """
    return {
        "callVolumeTrend": [
            {"date": "Mon", "calls": 245, "answered": 230},
            {"date": "Tue", "calls": 278, "answered": 265},
            {"date": "Wed", "calls": 312, "answered": 298},
            {"date": "Thu", "calls": 289, "answered": 275},
            {"date": "Fri", "calls": 335, "answered": 320},
            {"date": "Sat", "calls": 198, "answered": 185},
            {"date": "Sun", "calls": 156, "answered": 148},
        ],
        "callsByHour": [
            {"hour": "8 AM", "calls": 45},
            {"hour": "9 AM", "calls": 78},
            {"hour": "10 AM", "calls": 95},
            {"hour": "11 AM", "calls": 112},
            {"hour": "12 PM", "calls": 98},
            {"hour": "1 PM", "calls": 85},
            {"hour": "2 PM", "calls": 102},
            {"hour": "3 PM", "calls": 118},
            {"hour": "4 PM", "calls": 95},
            {"hour": "5 PM", "calls": 67},
        ],
        "satisfactionBreakdown": [
            {"name": "Excellent (5)", "value": 45},
            {"name": "Good (4)", "value": 32},
            {"name": "Average (3)", "value": 15},
            {"name": "Poor (2)", "value": 6},
            {"name": "Very Poor (1)", "value": 2},
        ],
        "agentPerformance": [
            {"agent": "Sarah Miller", "calls": 89, "avgTime": 4.5, "satisfaction": 4.8},
            {"agent": "John Davis", "calls": 82, "avgTime": 5.2, "satisfaction": 4.6},
            {"agent": "Emily Chen", "calls": 78, "avgTime": 4.8, "satisfaction": 4.7},
            {"agent": "Michael Brown", "calls": 75, "avgTime": 5.5, "satisfaction": 4.5},
            {"agent": "Lisa Anderson", "calls": 71, "avgTime": 5.0, "satisfaction": 4.6},
        ],
    }

# ============================================================================
# Power BI Endpoints
# ============================================================================

@app.get("/api/powerbi/embed-config")
async def get_powerbi_embed_config(
    request: Request,
    user_permissions: UserPermissions = Depends(require_permission(Permission.POWERBI_VIEW)),
    reportId: Optional[str] = None,
    workspaceId: Optional[str] = None
):
    """
    Get Power BI embed configuration including report ID, embed URL, and embed token.
    Supports both Service Principal (app-only) and On-Behalf-Of (OBO) authentication modes.
    Requires: POWERBI_VIEW permission
    
    Args:
        reportId: Optional specific report ID (overrides default from settings)
        workspaceId: Optional specific workspace ID (overrides default from settings)
    
    Returns:
        Dictionary containing:
        - reportId: Power BI report ID
        - embedUrl: Power BI embed URL
        - embedToken: Generated embed token (valid for 60 minutes)
        - tokenExpiration: ISO timestamp when the token expires
        - workspaceId: Power BI workspace ID (optional)
    
    Raises:
        HTTPException: If Power BI is not configured or token generation fails
    """
    if not powerbi_service:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Power BI service is not configured. Please check backend environment variables."
        )
    
    try:
        # Extract user's access token if using OBO flow
        user_access_token = None
        if not powerbi_service.use_service_principal:
            auth_header = request.headers.get("Authorization", "")
            if not auth_header.startswith("Bearer "):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Missing or invalid Authorization header (required for OBO flow)"
                )
            user_access_token = auth_header[7:]  # Remove "Bearer " prefix
        
        auth_mode = "Service Principal" if powerbi_service.use_service_principal else "OBO flow"
        logger.info(f"Generating Power BI embed config using {auth_mode} for user: {user_permissions.user_email}")
        
        # Get complete embed configuration
        # Use provided reportId and workspaceId if available, otherwise use defaults
        embed_config = await powerbi_service.get_embed_config(
            user_access_token=user_access_token,
            report_id=reportId,
            workspace_id=workspaceId
        )
        
        logger.info("Power BI embed config generated successfully")
        return embed_config.to_dict()
        
    except Exception as e:
        logger.error(f"Failed to get Power BI embed config: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate Power BI embed configuration: {str(e)}"
        )

@app.post("/api/powerbi/export-pdf")
@limiter.limit("10/minute")  # Rate limit: 10 PDF exports per minute
async def export_powerbi_report_to_pdf(
    request: Request,
    user_permissions: UserPermissions = Depends(require_permission(Permission.POWERBI_EXPORT)),
    reportId: Optional[str] = None,
    workspaceId: Optional[str] = None
):
    """
    Initiate PDF export for a Power BI report.
    Returns an export ID that can be used to check status and download the file.
    Requires: POWERBI_EXPORT permission
    
    Args:
        reportId: Optional specific report ID (overrides default from settings)
        workspaceId: Optional specific workspace ID (overrides default from settings)
    
    Returns:
        Dictionary containing:
        - id: Export operation ID
        - status: Export status (e.g., 'Running', 'Succeeded', 'Failed')
    
    Raises:
        HTTPException: If Power BI is not configured or export fails
    """
    if not powerbi_service:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Power BI service is not configured."
        )
    
    try:
        # Extract user's access token if using OBO flow
        user_access_token = None
        if not powerbi_service.use_service_principal:
            auth_header = request.headers.get("Authorization", "")
            if not auth_header.startswith("Bearer "):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Missing or invalid Authorization header (required for OBO flow)"
                )
            user_access_token = auth_header[7:]
        
        auth_mode = "Service Principal" if powerbi_service.use_service_principal else "OBO flow"
        logger.info(f"Initiating PDF export using {auth_mode} for user: {user_permissions.user_email}")
        
        export_data = await powerbi_service.export_report_to_pdf(
            user_access_token=user_access_token,
            report_id=reportId,
            workspace_id=workspaceId
        )
        
        return export_data
        
    except Exception as e:
        logger.error(f"Failed to export Power BI report to PDF: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to export report: {str(e)}"
        )

@app.get("/api/powerbi/export-status/{export_id}")
async def get_powerbi_export_status(
    export_id: str,
    request: Request,
    user_permissions: UserPermissions = Depends(require_permission(Permission.POWERBI_EXPORT)),
    reportId: Optional[str] = None,
    workspaceId: Optional[str] = None
):
    """
    Get the status of a Power BI export operation.
    Requires: POWERBI_EXPORT permission
    
    Args:
        export_id: Export operation ID from the export-pdf endpoint
        reportId: Optional specific report ID
        workspaceId: Optional specific workspace ID
    
    Returns:
        Dictionary with export status and information
    
    Raises:
        HTTPException: If status check fails
    """
    if not powerbi_service:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Power BI service is not configured."
        )
    
    try:
        # Extract user's access token if using OBO flow
        user_access_token = None
        if not powerbi_service.use_service_principal:
            auth_header = request.headers.get("Authorization", "")
            if not auth_header.startswith("Bearer "):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Missing or invalid Authorization header (required for OBO flow)"
                )
            user_access_token = auth_header[7:]
        
        logger.info(f"Getting export status for export_id: {export_id}")
        
        status_data = await powerbi_service.get_export_status(
            user_access_token=user_access_token,
            export_id=export_id,
            report_id=reportId,
            workspace_id=workspaceId
        )
        
        return status_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get export status: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get export status: {str(e)}"
        )

@app.get("/api/powerbi/export-file/{export_id}")
async def download_powerbi_export_file(
    export_id: str,
    request: Request,
    user_permissions: UserPermissions = Depends(require_permission(Permission.POWERBI_EXPORT)),
    reportId: Optional[str] = None,
    workspaceId: Optional[str] = None
):
    """
    Download the exported PDF file.
    Requires: POWERBI_EXPORT permission
    
    Args:
        export_id: Export operation ID
        reportId: Optional specific report ID
        workspaceId: Optional specific workspace ID
    
    Returns:
        PDF file as response
    
    Raises:
        HTTPException: If download fails
    """
    if not powerbi_service:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Power BI service is not configured."
        )
    
    try:
        # Extract user's access token if using OBO flow
        user_access_token = None
        if not powerbi_service.use_service_principal:
            auth_header = request.headers.get("Authorization", "")
            if not auth_header.startswith("Bearer "):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Missing or invalid Authorization header (required for OBO flow)"
                )
            user_access_token = auth_header[7:]
        
        file_bytes = await powerbi_service.get_export_file(
            user_access_token=user_access_token,
            export_id=export_id,
            report_id=reportId,
            workspace_id=workspaceId
        )
        
        from fastapi.responses import Response
        return Response(
            content=file_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=powerbi-report-{export_id}.pdf"
            }
        )
        
    except Exception as e:
        logger.error(f"Failed to download export file: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to download file: {str(e)}"
        )

@app.get("/api/powerbi/web-url")
async def get_powerbi_web_url(
    user_permissions: UserPermissions = Depends(require_permission(Permission.POWERBI_VIEW)),
    reportId: Optional[str] = None,
    workspaceId: Optional[str] = None
):
    """
    Get the Power BI web URL for opening the report in a browser.
    Requires: POWERBI_VIEW permission
    
    Args:
        reportId: Optional specific report ID
        workspaceId: Optional specific workspace ID
    
    Returns:
        Dictionary with webUrl
    
    Raises:
        HTTPException: If Power BI is not configured
    """
    if not powerbi_service:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Power BI service is not configured."
        )
    
    web_url = powerbi_service.get_report_web_url(
        report_id=reportId,
        workspace_id=workspaceId
    )
    
    return {"webUrl": web_url}

# ============================================================================
# Copilot Studio Endpoints
# ============================================================================

@app.post("/api/copilot-studio/token")
async def get_copilot_studio_token(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    user_permissions: UserPermissions = Depends(require_permission(Permission.CHAT_VIEW))
):
    """
    Create a Copilot Studio session.
    Uses On-Behalf-Of flow to impersonate the current user.
    Requires: CHAT_VIEW permission
    """
    if not copilot_studio_service:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Copilot Studio is not configured. Please set COPILOT_STUDIO environment variables."
        )
    
    # Get user information from UserPermissions
    user_id = user_permissions.user_id
    user_name = user_permissions.user_email.split('@')[0] if user_permissions.user_email else "User"
    user_token = credentials.credentials
    
    try:
        session_info = await copilot_studio_service.start_conversation(
            user_token=user_token,
            user_id=user_id,
            user_name=user_name
        )
        return session_info
        
    except Exception as e:
        logger.error(f"Copilot Studio session creation failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Unable to create Copilot Studio session: {str(e)}"
        )

@app.post("/api/copilot-studio/send-message")
@limiter.limit("30/minute")  # Rate limit: 30 messages per minute
async def send_message_to_copilot(
    request: Request,
    message_data: Dict,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    user_permissions: UserPermissions = Depends(require_permission(Permission.CHAT_CREATE))
):
    """
    Send a message to Copilot Studio and receive a response.
    Uses On-Behalf-Of flow to impersonate the current user.
    Requires: CHAT_CREATE permission
    """
    if not copilot_studio_service:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Copilot Studio is not configured."
        )
    
    try:
        conversation_id = message_data.get("conversationId")
        message_text = message_data.get("text")
        user_id = message_data.get("userId")
        
        if not all([conversation_id, message_text, user_id]):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="conversationId, text, and userId are required"
            )
        
        user_token = credentials.credentials
        
        response = await copilot_studio_service.send_message(
            conversation_id=conversation_id,
            message_text=message_text,
            user_token=user_token,
            user_id=user_id
        )
        
        return response
        
    except Exception as e:
        logger.error(f"Failed to send message to Copilot Studio: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send message: {str(e)}"
        )

@app.post("/api/copilot-studio/send-card-response")
async def send_card_response_to_copilot(
    message_data: Dict,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    user_permissions: UserPermissions = Depends(require_permission(Permission.CHAT_CREATE))
):
    """
    Send an Adaptive Card response (InvokeResponse activity) to Copilot Studio.
    This handles card submit actions like Allow/Cancel buttons.
    Requires: CHAT_CREATE permission
    """
    if not copilot_studio_service:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Copilot Studio is not configured."
        )
    
    try:
        conversation_id = message_data.get("conversationId")
        action_data = message_data.get("actionData")
        user_id = message_data.get("userId")
        
        if not all([conversation_id, action_data, user_id]):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="conversationId, actionData, and userId are required"
            )
        
        user_token = credentials.credentials
        
        response = await copilot_studio_service.send_card_response(
            conversation_id=conversation_id,
            action_data=action_data,
            user_token=user_token,
            user_id=user_id
        )
        
        return response
        
    except Exception as e:
        logger.error(f"Failed to send card response to Copilot Studio: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send card response: {str(e)}"
        )

# ============================================================================
# Azure AI Foundry Agent Endpoints
# ============================================================================

@app.post("/api/ai-foundry/token")
async def get_ai_foundry_token(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    user_permissions: UserPermissions = Depends(require_permission(Permission.AI_FOUNDRY_QUERY))
):
    """
    Initialize a new Azure AI Foundry conversation session.
    Returns the thread ID and welcome message.
    Requires: AI_FOUNDRY_QUERY permission
    """
    if not ai_foundry_service:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Azure AI Foundry is not configured."
        )
    
    user_token = credentials.credentials
    user_id = user_permissions.user_id
    user_name = user_permissions.user_email.split('@')[0] if user_permissions.user_email else "User"
    
    try:
        session_data = await ai_foundry_service.start_conversation(
            user_token=user_token,
            user_id=user_id,
            user_name=user_name
        )
        return session_data
        
    except Exception as e:
        logger.error(f"Failed to initialize Azure AI Foundry session: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to initialize session: {str(e)}"
        )

@app.post("/api/ai-foundry/send-message")
@limiter.limit("30/minute")  # Rate limit: 30 messages per minute
async def send_message_to_ai_foundry(
    request: Request,
    message_data: Dict,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    user_permissions: UserPermissions = Depends(require_permission(Permission.AI_FOUNDRY_QUERY))
):
    """
    Send a message to Azure AI Foundry and receive a response.
    Requires: AI_FOUNDRY_QUERY permission
    """
    if not ai_foundry_service:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Azure AI Foundry is not configured."
        )
    
    try:
        user_token = credentials.credentials
        conversation_id = message_data.get("conversationId")
        message_text = message_data.get("text")
        user_id = message_data.get("userId")
        
        if not all([conversation_id, message_text, user_id]):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="conversationId, text, and userId are required"
            )
        
        response = await ai_foundry_service.send_message(
            conversation_id=conversation_id,
            message_text=message_text,
            user_token=user_token,
            user_id=user_id
        )
        
        # Log response structure for debugging
        logger.info(f"📤 API Response: success={response.get('success')}, text_length={len(response.get('text', ''))}, attachments_count={len(response.get('attachments', []))}")
        if response.get('attachments'):
            for idx, att in enumerate(response.get('attachments', [])):
                logger.info(f"  📎 Attachment {idx}: contentType={att.get('contentType')}, has_content={bool(att.get('content'))}, name={att.get('name')}")
        
        return response
        
    except Exception as e:
        logger.error(f"Failed to send message to Azure AI Foundry: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send message: {str(e)}"
        )

@app.post("/api/ai-foundry/send-card-response")
async def send_card_response_to_ai_foundry(
    message_data: Dict,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    user_permissions: UserPermissions = Depends(require_permission(Permission.AI_FOUNDRY_QUERY))
):
    """
    Send an Adaptive Card response to Azure AI Foundry.
    This handles card submit actions like Allow/Cancel buttons.
    Requires: AI_FOUNDRY_QUERY permission
    """
    if not ai_foundry_service:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Azure AI Foundry is not configured."
        )
    
    try:
        user_token = credentials.credentials
        conversation_id = message_data.get("conversationId")
        action_data = message_data.get("actionData")
        user_id = message_data.get("userId")
        
        if not all([conversation_id, action_data, user_id]):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="conversationId, actionData, and userId are required"
            )
        
        response = await ai_foundry_service.send_card_response(
            conversation_id=conversation_id,
            action_data=action_data,
            user_token=user_token,
            user_id=user_id
        )
        
        return response
        
    except Exception as e:
        logger.error(f"Failed to send card response to Azure AI Foundry: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send card response: {str(e)}"
        )

# ============================================================================
# Chat History Management Endpoints
# ============================================================================

@app.get("/api/chat/conversations", response_model=List[ConversationSummary])
async def get_user_conversations(
    limit: int = 50,
    agent_id: Optional[str] = None,
    user_permissions: UserPermissions = Depends(require_permission(Permission.CHAT_VIEW))
):
    """
    Get conversation history for the authenticated user.
    Returns a list of conversation summaries.
    Requires: CHAT_VIEW permission
    """
    if not conversation_service:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Chat history service is not available."
        )
    
    user_id = user_permissions.user_id
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User ID not found in token"
        )
    
    try:
        conversations = await conversation_service.get_user_conversations(
            user_id=user_id, 
            limit=limit,
            agent_id=agent_id
        )
        return conversations
    except Exception as e:
        logger.error(f"Failed to get conversations for user {user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve conversation history"
        )

@app.post("/api/chat/conversations", response_model=ChatConversation, status_code=status.HTTP_201_CREATED)
async def create_conversation(
    request: CreateConversationRequest,
    user_permissions: UserPermissions = Depends(require_permission(Permission.CHAT_CREATE))
):
    """
    Create a new chat conversation.
    Requires: CHAT_CREATE permission
    """
    if not conversation_service:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Chat history service is not available."
        )
    
    user_id = user_permissions.user_id
    user_name = user_permissions.user_email.split('@')[0] if user_permissions.user_email else "User"
    
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User ID not found in token"
        )
    
    try:
        # Generate a new agent conversation ID (e.g., for Copilot Studio)
        agent_conversation_id = str(uuid.uuid4())
        
        conversation = await conversation_service.create_conversation(
            user_id=user_id,
            user_name=user_name,
            agent_conversation_id=agent_conversation_id,
            agent_id=request.agent_id,
            title=request.title,
            metadata=request.metadata
        )
        
        return conversation
    except Exception as e:
        logger.error(f"Failed to create conversation for user {user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create conversation"
        )

@app.get("/api/chat/conversations/{conversation_id}", response_model=ChatConversation)
async def get_conversation(
    conversation_id: str,
    user_permissions: UserPermissions = Depends(require_permission(Permission.CHAT_VIEW))
):
    """
    Get a specific conversation with full message history.
    Requires: CHAT_VIEW permission
    """
    if not conversation_service:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Chat history service is not available."
        )
    
    user_id = user_permissions.user_id
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User ID not found in token"
        )
    
    try:
        conversation = await conversation_service.get_conversation(conversation_id, user_id)
        if not conversation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found"
            )
        
        return conversation
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get conversation {conversation_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve conversation"
        )

@app.get("/api/chat/conversations/{conversation_id}/messages", response_model=List[ChatMessage])
async def get_messages(
    conversation_id: str,
    user_permissions: UserPermissions = Depends(require_permission(Permission.CHAT_VIEW))
):
    """
    Get all messages for a specific conversation/session.
    Requires: CHAT_VIEW permission
    """
    if not conversation_service:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Chat history service is not available."
        )
    
    user_id = user_permissions.user_id
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User ID not found in token"
        )
    
    try:
        messages = await conversation_service.get_conversation_messages(conversation_id, user_id)
        return messages
    except Exception as e:
        logger.error(f"Failed to get messages for conversation {conversation_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve messages"
        )

@app.post("/api/chat/conversations/{conversation_id}/messages")
async def add_message(
    conversation_id: str,
    message: ChatMessage,
    user_permissions: UserPermissions = Depends(require_permission(Permission.CHAT_CREATE))
):
    """
    Add a message to an existing conversation.
    Requires: CHAT_CREATE permission
    """
    if not conversation_service:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Chat history service is not available."
        )
    
    user_id = user_permissions.user_id
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User ID not found in token"
        )
    
    try:
        success = await conversation_service.add_message(
            conversation_id=conversation_id,
            user_id=user_id,
            content=message.content,
            role=message.role,
            attachments=message.attachments if hasattr(message, 'attachments') else None,
            metadata={
                "tokens": message.tokens if hasattr(message, 'tokens') else None,
                "toolCalls": message.tool_calls if hasattr(message, 'tool_calls') else None,
                "vector": message.vector if hasattr(message, 'vector') else None,
                "grounding": message.grounding if hasattr(message, 'grounding') else None
            }
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found or message could not be added"
            )
        
        return {"success": True, "message": "Message added successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to add message to conversation {conversation_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to add message"
        )

@app.delete("/api/chat/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: str,
    user_permissions: UserPermissions = Depends(require_permission(Permission.CHAT_DELETE))
):
    """
    Delete (soft delete) a conversation.
    Requires: CHAT_DELETE permission
    """
    if not conversation_service:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Chat history service is not available."
        )
    
    user_id = user_permissions.user_id
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User ID not found in token"
        )
    
    try:
        success = await conversation_service.delete_conversation(conversation_id, user_id)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found"
            )
        
        return {"success": True, "message": "Conversation deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete conversation {conversation_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete conversation"
        )

# ============================================================================
# Query Template Management Endpoints
# ============================================================================

@app.get("/api/query-templates", response_model=QueryTemplateList)
async def list_query_templates(
    category: Optional[str] = None,
    user_permissions: UserPermissions = Depends(require_permission(Permission.TEMPLATES_VIEW))
):
    """
    List all query templates (protected endpoint).
    Optionally filter by category.
    Requires: TEMPLATES_VIEW permission
    """
    user_id = user_permissions.user_id
    
    templates = list(query_templates_db.values())
    
    # Filter by category if provided
    if category:
        templates = [t for t in templates if t.category == category]
    
    # Filter to show only user's own templates or public templates
    filtered_templates = [
        t for t in templates
        if t.user_id is None or t.user_id == user_id
    ]
    
    return QueryTemplateList(
        templates=filtered_templates,
        total=len(filtered_templates)
    )

@app.post("/api/query-templates", response_model=QueryTemplate, status_code=status.HTTP_201_CREATED)
async def create_query_template(
    template_data: QueryTemplateCreate,
    user_permissions: UserPermissions = Depends(require_permission(Permission.TEMPLATES_CREATE))
):
    """
    Create a new query template (protected endpoint).
    Requires: TEMPLATES_CREATE permission
    """
    user_id = user_permissions.user_id
    
    # Generate unique ID
    template_id = str(uuid.uuid4())
    
    # Create template
    now = datetime.utcnow()
    template = QueryTemplate(
        id=template_id,
        name=template_data.name,
        description=template_data.description,
        template=template_data.template,
        category=template_data.category,
        user_id=template_data.user_id or user_id,
        team_id=template_data.team_id,
        is_active=True,
        created_at=now,
        updated_at=now
    )
    
    query_templates_db[template_id] = template
    logger.info(f"Created query template: {template_id} by user: {user_id}")
    
    return template

@app.get("/api/query-templates/{template_id}", response_model=QueryTemplate)
async def get_query_template(
    template_id: str,
    user_permissions: UserPermissions = Depends(require_permission(Permission.TEMPLATES_VIEW))
):
    """
    Get a specific query template by ID (protected endpoint).
    Requires: TEMPLATES_VIEW permission
    """
    if template_id not in query_templates_db:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Query template not found"
        )
    
    return query_templates_db[template_id]

@app.put("/api/query-templates/{template_id}", response_model=QueryTemplate)
async def update_query_template(
    template_id: str,
    template_update: QueryTemplateUpdate,
    user_permissions: UserPermissions = Depends(require_permission(Permission.TEMPLATES_UPDATE))
):
    """
    Update an existing query template (protected endpoint).
    Requires: TEMPLATES_UPDATE permission
    """
    if template_id not in query_templates_db:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Query template not found"
        )
    
    template = query_templates_db[template_id]
    user_id = user_permissions.user_id
    
    # Check ownership (only owner can update)
    if template.user_id and template.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to update this template"
        )
    
    # Update fields
    update_data = template_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(template, field, value)
    
    template.updated_at = datetime.utcnow()
    query_templates_db[template_id] = template
    
    logger.info(f"Updated query template: {template_id} by user: {user_id}")
    
    return template

@app.delete("/api/query-templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_query_template(
    template_id: str,
    user_permissions: UserPermissions = Depends(require_permission(Permission.TEMPLATES_DELETE))
):
    """
    Delete a query template (protected endpoint).
    Requires: TEMPLATES_DELETE permission
    """
    if template_id not in query_templates_db:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Query template not found"
        )
    
    template = query_templates_db[template_id]
    user_id = user_permissions.user_id
    
    # Check ownership (only owner can delete)
    if template.user_id and template.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to delete this template"
        )
    
    del query_templates_db[template_id]
    logger.info(f"Deleted query template: {template_id} by user: {user_id}")
    
    return None

# Initialize with some default templates
def initialize_default_templates():
    """Initialize some default query templates."""
    default_templates = [
        QueryTemplate(
            id=str(uuid.uuid4()),
            name="Get Agent Performance",
            description="Query agent performance metrics",
            template="Show me performance metrics for {agent_name} in the last {time_period}",
            category="Performance",
            is_active=True,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        ),
        QueryTemplate(
            id=str(uuid.uuid4()),
            name="Call Volume Analysis",
            description="Analyze call volume trends",
            template="Analyze call volume trends for {date_range}",
            category="Analytics",
            is_active=True,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        ),
        QueryTemplate(
            id=str(uuid.uuid4()),
            name="Customer Satisfaction Report",
            description="Get customer satisfaction insights",
            template="Generate customer satisfaction report for {period} with breakdown by {metric}",
            category="Reports",
            is_active=True,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        ),
    ]
    
    for template in default_templates:
        query_templates_db[template.id] = template

# Initialize default templates on startup
initialize_default_templates()

# ============================================================================
# RBAC Management Endpoints
# ============================================================================

@app.get("/api/rbac/permissions", response_model=UserPermissions)
async def get_my_permissions(user_permissions: UserPermissions = Depends(get_user_permissions)):
    """
    Get current user's permissions.
    """
    return user_permissions

@app.get("/api/rbac/roles", response_model=List[RoleDefinition])
async def list_roles(
    include_disabled: bool = False,
    user_permissions: UserPermissions = Depends(require_permission(Permission.ADMIN_ROLES_VIEW))
):
    """
    List all available roles (built-in and custom).
    Requires ADMIN_ROLES_VIEW permission.
    """
    if not rbac_service:
        raise HTTPException(status_code=503, detail="RBAC service not available")
    
    return await rbac_service.list_all_roles(include_disabled=include_disabled)

@app.post("/api/rbac/roles", response_model=RoleDefinition, status_code=status.HTTP_201_CREATED)
async def create_role(
    request: CreateRoleRequest,
    user_permissions: UserPermissions = Depends(require_permission(Permission.ADMIN_ROLES_MANAGE))
):
    """
    Create a new custom role.
    Requires ADMIN_ROLES_MANAGE permission.
    """
    if not rbac_service:
        raise HTTPException(status_code=503, detail="RBAC service not available")
    
    return await rbac_service.create_custom_role(
        request=request,
        created_by=user_permissions.user_id
    )

@app.put("/api/rbac/roles/{role_id}", response_model=RoleDefinition)
async def update_role(
    role_id: str,
    request: UpdateRoleRequest,
    user_permissions: UserPermissions = Depends(require_permission(Permission.ADMIN_ROLES_MANAGE))
):
    """
    Update a custom role.
    Built-in roles cannot be updated.
    Requires ADMIN_ROLES_MANAGE permission.
    """
    if not rbac_service:
        raise HTTPException(status_code=503, detail="RBAC service not available")
    
    return await rbac_service.update_custom_role(
        role_id=role_id,
        request=request,
        updated_by=user_permissions.user_id
    )

@app.delete("/api/rbac/roles/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_role(
    role_id: str,
    user_permissions: UserPermissions = Depends(require_permission(Permission.ADMIN_ROLES_MANAGE))
):
    """
    Delete a custom role.
    Built-in roles cannot be deleted.
    Requires ADMIN_ROLES_MANAGE permission.
    """
    if not rbac_service:
        raise HTTPException(status_code=503, detail="RBAC service not available")
    
    await rbac_service.delete_custom_role(
        role_id=role_id,
        deleted_by=user_permissions.user_id
    )
    return None

@app.get("/api/rbac/permissions/available", response_model=List[Dict[str, str]])
async def list_available_permissions(
    user_permissions: UserPermissions = Depends(require_permission(Permission.ADMIN_ROLES_VIEW))
):
    """
    List all available permissions that can be assigned to roles.
    Requires ADMIN_ROLES_VIEW permission.
    """
    return [
        {"value": perm.value, "name": perm.name}
        for perm in Permission
    ]

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
