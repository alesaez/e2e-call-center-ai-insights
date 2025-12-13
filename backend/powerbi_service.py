"""
Power BI Service for generating embed tokens and retrieving report metadata.
Uses On-Behalf-Of (OBO) flow to access Power BI with user's permissions.
"""
import logging
from typing import Optional, Dict, Any
from datetime import datetime, timedelta
import httpx
from msal import ConfidentialClientApplication

logger = logging.getLogger(__name__)


class PowerBIEmbedConfig:
    """Power BI embed configuration model."""
    
    def __init__(
        self,
        report_id: str,
        embed_url: str,
        embed_token: str,
        token_expiration: datetime,
        workspace_id: Optional[str] = None
    ):
        self.report_id = report_id
        self.embed_url = embed_url
        self.embed_token = embed_token
        self.token_expiration = token_expiration
        self.workspace_id = workspace_id
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "reportId": self.report_id,
            "embedUrl": self.embed_url,
            "embedToken": self.embed_token,
            "tokenExpiration": self.token_expiration.isoformat(),
            "workspaceId": self.workspace_id
        }


class PowerBIService:
    """
    Service for interacting with Power BI REST API.
    Uses On-Behalf-Of (OBO) flow to access Power BI with user's permissions.
    This allows users with Power BI access to view reports through the app.
    """
    
    POWER_BI_API_BASE = "https://api.powerbi.com/v1.0/myorg"
    POWER_BI_SCOPE = "https://analysis.windows.net/powerbi/api/.default"
    
    def __init__(
        self,
        tenant_id: str,
        client_id: str,
        client_secret: str,
        workspace_id: str,
        report_id: str
    ):
        """
        Initialize Power BI service for OBO flow.
        
        Args:
            tenant_id: Azure AD tenant ID
            client_id: Backend app registration client ID
            client_secret: Backend app registration client secret
            workspace_id: Power BI workspace ID (group ID)
            report_id: Power BI report ID
        """
        self.tenant_id = tenant_id
        self.client_id = client_id
        self.client_secret = client_secret
        self.workspace_id = workspace_id
        self.report_id = report_id
        
        # Initialize MSAL confidential client for OBO flow
        self.msal_app = ConfidentialClientApplication(
            client_id=self.client_id,
            client_credential=self.client_secret,
            authority=f"https://login.microsoftonline.com/{self.tenant_id}"
        )
        
        logger.info(
            f"PowerBI Service initialized for OBO flow: workspace={workspace_id}, report={report_id}"
        )
    
    async def _get_access_token(self, user_access_token: str) -> str:
        """
        Acquire Power BI access token using On-Behalf-Of (OBO) flow.
        Exchanges the user's access token for a Power BI token.
        
        Args:
            user_access_token: The user's access token from the frontend
        
        Returns:
            Access token for Power BI API (on behalf of the user)
        
        Raises:
            Exception: If token acquisition fails
        """
        logger.info("Acquiring Power BI access token via OBO flow")
        
        # Acquire token using On-Behalf-Of flow
        result = self.msal_app.acquire_token_on_behalf_of(
            user_assertion=user_access_token,
            scopes=[self.POWER_BI_SCOPE]
        )
        
        if "access_token" not in result:
            error_msg = result.get("error_description", result.get("error", "Unknown error"))
            logger.error(f"Failed to acquire Power BI access token via OBO: {error_msg}")
            raise Exception(f"Failed to acquire Power BI access token: {error_msg}")
        
        logger.info("Power BI access token acquired successfully via OBO")
        return result["access_token"]
    
    async def get_report_metadata(self, access_token: str) -> Dict[str, Any]:
        """
        Fetch report metadata from Power BI REST API.
        
        Args:
            access_token: Power BI access token (from OBO flow)
        
        Returns:
            Dictionary containing report metadata including embedUrl
        
        Raises:
            Exception: If API call fails
        """
        # Build API URL
        if self.workspace_id:
            url = f"{self.POWER_BI_API_BASE}/groups/{self.workspace_id}/reports/{self.report_id}"
        else:
            url = f"{self.POWER_BI_API_BASE}/reports/{self.report_id}"
        
        logger.info(f"Fetching Power BI report metadata: {self.report_id}")
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                url,
                headers={"Authorization": f"Bearer {access_token}"}
            )
            
            if response.status_code != 200:
                error_msg = f"Failed to fetch report metadata: {response.status_code} {response.text}"
                logger.error(error_msg)
                raise Exception(error_msg)
            
            report_data = response.json()
            logger.info(f"Report metadata retrieved: {report_data.get('name', 'unknown')}")
            return report_data
    
    async def generate_embed_token(
        self,
        access_token: str,
        report_metadata: Dict[str, Any],
        access_level: str = "View",
        token_lifetime_minutes: int = 60
    ) -> str:
        """
        Generate an embed token for the report.
        
        Args:
            access_token: Power BI access token (from OBO flow)
            report_metadata: Report metadata containing datasetId
            access_level: Access level for the embed token (View, Edit, Create)
            token_lifetime_minutes: Lifetime of the embed token in minutes (max 1440 = 24 hours)
        
        Returns:
            Embed token string
        
        Raises:
            Exception: If token generation fails
        """
        # Build embed token request
        url = f"{self.POWER_BI_API_BASE}/GenerateToken"
        
        # Calculate token expiration
        token_expiration = datetime.utcnow() + timedelta(minutes=token_lifetime_minutes)
        
        # Extract dataset ID from report metadata
        dataset_id = report_metadata.get("datasetId")
        if not dataset_id:
            raise Exception("Dataset ID not found in report metadata")
        
        request_body = {
            "datasets": [
                {
                    "id": dataset_id
                }
            ],
            "reports": [
                {
                    "id": self.report_id,
                    "allowEdit": access_level in ["Edit", "Create"]
                }
            ],
            "targetWorkspaces": [],
            "identities": []  # For RLS, add user identities here if needed
        }
        
        logger.info(f"Generating Power BI embed token for report: {self.report_id}")
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                url,
                json=request_body,
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json"
                }
            )
            
            if response.status_code != 200:
                error_msg = f"Failed to generate embed token: {response.status_code} {response.text}"
                logger.error(error_msg)
                raise Exception(error_msg)
            
            result = response.json()
            embed_token = result.get("token")
            
            if not embed_token:
                logger.error("Embed token not found in response")
                raise Exception("Embed token not found in response")
            
            logger.info("Embed token generated successfully")
            return embed_token
    
    async def get_embed_config(
        self, 
        user_access_token: str,
        report_id: Optional[str] = None,
        workspace_id: Optional[str] = None
    ) -> PowerBIEmbedConfig:
        """
        Get complete embed configuration including report metadata and embed token.
        Uses On-Behalf-Of flow to access Power BI with user's permissions.
        
        Args:
            user_access_token: The user's access token from the frontend
            report_id: Optional specific report ID (overrides instance default)
            workspace_id: Optional specific workspace ID (overrides instance default)
        
        Returns:
            PowerBIEmbedConfig object with all required embed information
        
        Raises:
            Exception: If any step fails
        """
        # Use provided IDs or fall back to defaults
        target_report_id = report_id or self.report_id
        target_workspace_id = workspace_id or self.workspace_id
        
        logger.info(f"Getting embed config for report: {target_report_id}")
        
        # Get Power BI access token via OBO flow
        powerbi_access_token = await self._get_access_token(user_access_token)
        
        # Fetch report metadata (includes embedUrl and datasetId)
        # Temporarily override instance variables for metadata fetch
        original_report_id = self.report_id
        original_workspace_id = self.workspace_id
        
        try:
            self.report_id = target_report_id
            self.workspace_id = target_workspace_id
            
            report_metadata = await self.get_report_metadata(powerbi_access_token)
            embed_url = report_metadata.get("embedUrl")
            
            if not embed_url:
                raise Exception("Embed URL not found in report metadata")
            
            # Generate embed token (requires dataset ID from metadata)
            embed_token = await self.generate_embed_token(powerbi_access_token, report_metadata)
            token_expiration = datetime.utcnow() + timedelta(minutes=60)
            
            # Create embed config object
            config = PowerBIEmbedConfig(
                report_id=target_report_id,
                embed_url=embed_url,
                embed_token=embed_token,
                token_expiration=token_expiration,
                workspace_id=target_workspace_id
            )
            
            logger.info("Embed config created successfully")
            return config
        finally:
            # Restore original values
            self.report_id = original_report_id
            self.workspace_id = original_workspace_id
