"""
FastAPI backend with Microsoft Entra ID (Azure AD) authentication.
Uses JWT token validation to secure API endpoints.
"""
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional, Dict, List
import httpx
import logging
from jose import jwt, JWTError
from functools import lru_cache
from datetime import datetime
from config import Settings
from models import (
    QueryTemplate,
    QueryTemplateCreate,
    QueryTemplateUpdate,
    QueryTemplateList
)
import uuid
from microsoft_agents.copilotstudio.client import CopilotClient
from microsoft_agents.copilotstudio.client.connection_settings import ConnectionSettings
from microsoft_agents.activity import Activity
from msal import ConfidentialClientApplication

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(title="Call Center AI Insights API")

# In-memory storage for query templates (replace with database in production)
query_templates_db: Dict[str, QueryTemplate] = {}

# Security scheme
security = HTTPBearer()

# Cached settings
@lru_cache()
def get_settings():
    return Settings()

# CORS configuration
settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Cache for JWKS (JSON Web Key Set)
_jwks_cache: Optional[Dict] = None

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
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(jwks_url, timeout=10.0)
            response.raise_for_status()
            _jwks_cache = response.json()
            return _jwks_cache
    except Exception as e:
        logger.error(f"Failed to fetch JWKS: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch signing keys"
        )

async def verify_token(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> Dict:
    """
    Verify JWT access token from Microsoft Entra ID.
    
    Steps:
    1. Extract token from Authorization header
    2. Fetch JWKS from Microsoft
    3. Validate token signature and claims
    4. Return decoded token payload
    """
    token = credentials.credentials
    settings = get_settings()
    
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
        logger.info(f"Token audience (unverified): {unverified_payload.get('aud')}")
        logger.info(f"Token issuer (unverified): {unverified_payload.get('iss')}")
        
        # Accept both v1.0 and v2.0 token issuers
        v1_issuer = f"https://sts.windows.net/{settings.ENTRA_TENANT_ID}/"
        v2_issuer = f"https://login.microsoftonline.com/{settings.ENTRA_TENANT_ID}/v2.0"
        
        # Determine which issuer to use based on the token
        token_issuer = unverified_payload.get('iss')
        expected_issuer = v1_issuer if token_issuer == v1_issuer else v2_issuer
        
        # Try to decode with the api:// prefixed audience first
        api_audience = f"api://{settings.ENTRA_CLIENT_ID}"
        
        logger.info(f"Validating token with audience: {api_audience}")
        logger.info(f"Using issuer: {expected_issuer}")
        
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
            logger.info(f"Trying fallback audience: {settings.ENTRA_CLIENT_ID}")
            payload = jwt.decode(
                token,
                rsa_key,
                algorithms=["RS256"],
                audience=settings.ENTRA_CLIENT_ID,
                issuer=expected_issuer
            )
        
        logger.info(f"Token validated successfully for user: {payload.get('upn', payload.get('email', 'unknown'))}")
        return payload
        
    except JWTError as e:
        logger.error(f"JWT validation error: {e}")
        logger.error(f"Error type: {type(e).__name__}")
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

# Health check endpoint (public)
@app.get("/health")
async def health_check():
    """Public health check endpoint."""
    return {"status": "healthy"}

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
async def get_dashboard_kpis(token_payload: Dict = Depends(verify_token)):
    """
    Get dashboard KPI data (protected endpoint).
    Returns mock data for demonstration.
    """
    return {
        "totalCalls": 1543,
        "avgHandlingTime": "5:32",
        "customerSatisfaction": 4.5,
        "agentAvailability": 87,
        "escalationRate": 12.3
    }

@app.get("/api/dashboard/charts")
async def get_dashboard_charts(token_payload: Dict = Depends(verify_token)):
    """
    Get dashboard chart data (protected endpoint).
    Returns mock data for charts and visualizations.
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

@app.post("/api/copilot-studio/token")
async def get_copilot_studio_token(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    token_payload: Dict = Depends(verify_token)
):
    """
    Create a Copilot Studio session using the microsoft-agents-copilotstudio-client library.
    Uses On-Behalf-Of flow to impersonate the current user.
    """
    settings = get_settings()
    
    if not settings.copilot_studio:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Copilot Studio is not configured. Please set COPILOT_STUDIO environment variables."
        )
    
    if not settings.copilot_studio.environment_id or not settings.copilot_studio.schema_name:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Copilot Studio environment_id and schema_name are required."
        )
    
    # Get user information from JWT token
    user_id = token_payload.get("sub") or token_payload.get("oid") or "user"
    user_name = token_payload.get("name", "User")
    
    try:
        # Initialize Copilot Studio Client with connection settings
        environment_id = settings.copilot_studio.environment_id
        schema_name = settings.copilot_studio.schema_name
        
        # Create connection settings with agent_identifier
        connection_settings = ConnectionSettings(
            environment_id=environment_id,
            agent_identifier=schema_name,
            cloud=None,
            copilot_agent_type=None,
            custom_power_platform_cloud=None,
        )
        
        # Acquire token for Copilot Studio using MSAL with On-Behalf-Of flow
        if not settings.copilot_studio.app_client_secret:
            logger.warning("No client secret provided, using connection without token")
            client = CopilotClient(connection_settings, None)
        else:
            # Get the user's token from the request
            user_token = credentials.credentials
            
            # Use MSAL to acquire token on behalf of the user
            msal_app = ConfidentialClientApplication(
                client_id=settings.copilot_studio.app_client_id,
                client_credential=settings.copilot_studio.app_client_secret,
                authority=f"https://login.microsoftonline.com/{settings.copilot_studio.tenant_id}"
            )
            
            # Acquire token for Power Platform API on behalf of the user
            token_result = msal_app.acquire_token_on_behalf_of(
                user_assertion=user_token,
                scopes=["https://api.powerplatform.com/.default"]
            )
            
            if "access_token" not in token_result:
                error_msg = token_result.get('error_description', token_result.get('error', 'Unknown error'))
                logger.error(f"Failed to acquire token: {error_msg}")
                raise Exception(f"Failed to acquire token: {error_msg}")
            
            # Create client instance with connection settings and token
            client = CopilotClient(connection_settings, token_result["access_token"])
        
        # Start conversation - returns an async generator
        act = client.start_conversation(True)
        
        async for action in act:
            if action.text:
                welcomeMessage = action.text
                
        conversation_id = action.conversation.id
                
        # The conversation is started when we send the first message
        logger.info(f"Copilot Studio session initialized with conversation_id: {conversation_id}")
        
        return {
            "conversationId": conversation_id,
            "userId": user_id,
            "userName": user_name,
            "environmentId": environment_id,
            "schemaName": schema_name,
            "endpoint": f"https://{environment_id}.api.powerplatform.com/v1.0/bots/{schema_name}",
            "expiresIn": 3600,  # 1 hour
            "sessionCreated": True,
            "welcomeMessage": welcomeMessage
        }
        
    except Exception as e:
        logger.error(f"Copilot Studio session creation failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Unable to create Copilot Studio session: {str(e)}"
        )

@app.post("/api/copilot-studio/send-message")
async def send_message_to_copilot(
    message_data: Dict,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    token_payload: Dict = Depends(verify_token)
):
    """
    Send a message to Copilot Studio and receive a response.
    Uses On-Behalf-Of flow to impersonate the current user.
    """
    settings = get_settings()
    
    if not settings.copilot_studio:
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
        
        # Initialize Copilot Studio Client with connection settings
        connection_settings = ConnectionSettings(
            environment_id=settings.copilot_studio.environment_id,
            agent_identifier=settings.copilot_studio.schema_name,
            cloud=None,
            copilot_agent_type=None,
            custom_power_platform_cloud=None,
        )
        
        # Use On-Behalf-Of flow to get Power Platform token as the user
        if not settings.copilot_studio.app_client_secret:
            logger.warning("No client secret provided, using connection without token")
            client = CopilotClient(connection_settings, None)
        else:
            # Get the user's token from the request
            user_token = credentials.credentials
            
            msal_app = ConfidentialClientApplication(
                settings.copilot_studio.app_client_id,
                authority=f"https://login.microsoftonline.com/{settings.copilot_studio.tenant_id}",
                client_credential=settings.copilot_studio.app_client_secret,
            )
            
            # Use On-Behalf-Of flow to exchange user token for Power Platform token
            result = msal_app.acquire_token_on_behalf_of(
                user_assertion=user_token,
                scopes=["https://api.powerplatform.com/.default"]
            )
            
            if "access_token" not in result:
                logger.error(f"Failed to acquire token: {result.get('error_description', 'Unknown error')}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to acquire Copilot Studio token"
                )
            
            client = CopilotClient(connection_settings, result["access_token"])
        
        # Send message using ask_question method - it returns an async generator
        response_text = ""
        activities = []
        
        async for activity in client.ask_question(
            conversation_id=conversation_id,
            question=message_text
        ):
            activities.append(activity)
            # Collect text from bot activities - activity is a Pydantic model
            if hasattr(activity, 'from_property') and hasattr(activity.from_property, 'role'):
                if activity.from_property.role == 'bot' and hasattr(activity, 'text'):
                    response_text = activity.text
            # Fallback: try as dict
            elif isinstance(activity, dict):
                if activity.get('from', {}).get('role') == 'bot' and activity.get('text'):
                    response_text = activity.get('text', '')
        
        # If no response text was collected, use a default message
        if not response_text:
            response_text = "I received your message."
        
        return {
            "success": True,
            "response": response_text,
            "conversationId": conversation_id
        }
        
    except Exception as e:
        logger.error(f"Failed to send message to Copilot Studio: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send message: {str(e)}"
        )

# ============================================================================
# Query Template Management Endpoints
# ============================================================================

@app.get("/api/query-templates", response_model=QueryTemplateList)
async def list_query_templates(
    category: Optional[str] = None,
    token_payload: Dict = Depends(verify_token)
):
    """
    List all query templates (protected endpoint).
    Optionally filter by category.
    """
    user_id = token_payload.get("sub") or token_payload.get("oid")
    
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
    token_payload: Dict = Depends(verify_token)
):
    """
    Create a new query template (protected endpoint).
    """
    user_id = token_payload.get("sub") or token_payload.get("oid")
    
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
    token_payload: Dict = Depends(verify_token)
):
    """
    Get a specific query template by ID (protected endpoint).
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
    token_payload: Dict = Depends(verify_token)
):
    """
    Update an existing query template (protected endpoint).
    """
    if template_id not in query_templates_db:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Query template not found"
        )
    
    template = query_templates_db[template_id]
    user_id = token_payload.get("sub") or token_payload.get("oid")
    
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
    token_payload: Dict = Depends(verify_token)
):
    """
    Delete a query template (protected endpoint).
    """
    if template_id not in query_templates_db:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Query template not found"
        )
    
    template = query_templates_db[template_id]
    user_id = token_payload.get("sub") or token_payload.get("oid")
    
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
