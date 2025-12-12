"""
Configuration management using Pydantic Settings.
Loads environment variables and provides validation.
"""
from pydantic import ConfigDict
from pydantic_settings import BaseSettings
from typing import List, Optional
from pathlib import Path
import logging
from ui_config import get_ui_config_manager

# Configure Azure SDK logging to be less verbose (globally)
# Can be overridden with AZURE_SDK_VERBOSE_LOGGING=true environment variable
import os

verbose_logging = os.getenv("AZURE_SDK_VERBOSE_LOGGING", "false").lower() == "true"
log_level = logging.DEBUG if verbose_logging else logging.ERROR

# Suppress HTTP request/response logging from Azure SDKs unless explicitly enabled
azure_loggers_to_suppress = [
    "azure.core.pipeline.policies.http_logging_policy",
    "azure.cosmos",
    "azure.cosmos.aio", 
    "azure.cosmos._cosmos_client_connection",
    "azure.identity",
    "azure.identity._internal", 
    "azure.identity.aio",
    "msal",
    "urllib3.connectionpool",
    "requests.packages.urllib3.connectionpool"
]

for logger_name in azure_loggers_to_suppress:
    logging.getLogger(logger_name).setLevel(log_level)

# Get the directory where this config.py file is located
BASE_DIR = Path(__file__).resolve().parent

class CopilotStudioSettings(BaseSettings):
    """
    Copilot Studio agent configuration settings.
    """
    model_config = ConfigDict(
        env_file=str(BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        env_prefix="COPILOT_STUDIO_",
        case_sensitive=False,
        extra="ignore"  # Ignore extra environment variables from the .env file
    )
    
    direct_connect_url: Optional[str] = ""
    environment_id: str
    schema_name: str
    tenant_id: str
    app_client_id: str
    app_client_secret: Optional[str] = ""

class AIFoundrySettings(BaseSettings):
    """
    Azure AI Foundry agent configuration settings.
    Parses project details from the endpoint URL.
    """
    model_config = ConfigDict(
        env_file=str(BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        env_prefix="AI_FOUNDRY_",
        case_sensitive=False,
        extra="ignore"  # Ignore extra environment variables from the .env file
    )
    
    endpoint: str  # Full endpoint URL (e.g., https://xxx-aifoundry.services.ai.azure.com/api/projects/ProjectName)
    agent_id: str
    tenant_id: str  # Required for MSAL OBO flow
    app_client_id: str  # Required for MSAL OBO flow
    app_client_secret: Optional[str] = ""  # Required for MSAL OBO flow
    send_welcome_message: bool = True
    
    @property
    def project_name(self) -> str:
        """Extract project name from endpoint URL."""
        # Parse: https://xxx-aifoundry.services.ai.azure.com/api/projects/ProjectName
        try:
            parts = self.endpoint.rstrip('/').split('/projects/')
            if len(parts) == 2:
                return parts[1].split('/')[0]  # Get ProjectName, handle trailing segments
            return "unknown"
        except Exception:
            return "unknown"
    
    @property
    def host(self) -> str:
        """Extract host from endpoint URL."""
        # Parse: https://xxx-aifoundry.services.ai.azure.com
        try:
            from urllib.parse import urlparse
            parsed = urlparse(self.endpoint)
            return f"{parsed.scheme}://{parsed.netloc}"
        except Exception:
            return self.endpoint.split('/api/')[0] if '/api/' in self.endpoint else self.endpoint

class PowerBISettings(BaseSettings):
    """
    Power BI configuration settings for embed token generation.
    Uses service principal (app registration) for authentication.
    """
    model_config = ConfigDict(
        env_file=str(BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        env_prefix="POWERBI_",
        case_sensitive=False,
        extra="ignore"
    )
    
    tenant_id: str  # Azure AD tenant ID
    client_id: str  # Service principal client ID
    client_secret: str  # Service principal client secret
    workspace_id: str  # Power BI workspace (group) ID
    report_id: str  # Power BI report ID


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.
    """
    model_config = ConfigDict(
        env_file=str(BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"  # Ignore extra environment variables like COPILOT_STUDIO_*
    )
    
    # Microsoft Entra ID Configuration
    ENTRA_TENANT_ID: str
    ENTRA_CLIENT_ID: str
    
    # CORS Configuration
    # Note: In Azure Container Apps, CORS is handled at the ingress level
    # For local development, these defaults allow localhost
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",  # Vite default port
    ]
    
    # Optional: API Configuration
    API_TITLE: str = "Call Center AI Insights API"
    API_VERSION: str = "1.0.0"
    
    # Azure Cosmos DB Configuration
    # Uses DefaultAzureCredential for localhost and ManagedIdentityCredential for Azure Container Apps
    COSMOS_DB_ACCOUNT_URI: Optional[str] = None  # Required (e.g., https://your-account.documents.azure.com:443/)
    COSMOS_DB_DATABASE_NAME: str = "ContosoSuites"
    COSMOS_DB_SESSIONS_CONTAINER: str = "Sessions"
    COSMOS_DB_MESSAGES_CONTAINER: str = "Messages"
    
    # Copilot Studio Configuration
    copilot_studio: Optional[CopilotStudioSettings] = None
    
    # Azure AI Foundry Configuration
    ai_foundry: Optional[AIFoundrySettings] = None
    
    # Power BI Configuration
    powerbi: Optional[PowerBISettings] = None
    
    # UI Configuration Manager
    UI_CONFIG_ENVIRONMENT: str = "prod"  # Environment for UI config (dev, staging, prod)
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        
        # Initialize UI configuration manager (stored as private to avoid Pydantic validation)
        object.__setattr__(self, '_ui_config_manager', get_ui_config_manager(environment=self.UI_CONFIG_ENVIRONMENT))
        
        # Load Copilot Studio if enabled in UI config
        if self._ui_config_manager.should_load_service("copilot-studio"):
            try:
                self.copilot_studio = CopilotStudioSettings()
                print(f"✓ Copilot Studio configured: environment_id={self.copilot_studio.environment_id}, schema_name={self.copilot_studio.schema_name}")
            except Exception as e:
                print(f"⚠ Copilot Studio not configured (service disabled): {e}")
                self.copilot_studio = None
        else:
            print("ℹ Copilot Studio disabled by UI configuration")
            self.copilot_studio = None
        
        # Load Azure AI Foundry if enabled in UI config
        if self._ui_config_manager.should_load_service("ai-foundry"):
            try:
                self.ai_foundry = AIFoundrySettings()
                print(f"✓ Azure AI Foundry configured: project={self.ai_foundry.project_name}, agent={self.ai_foundry.agent_id}")
            except Exception as e:
                print(f"⚠ Azure AI Foundry not configured (service disabled): {e}")
                self.ai_foundry = None
        else:
            print("ℹ Azure AI Foundry disabled by UI configuration")
            self.ai_foundry = None
        
        # Load Power BI if enabled in UI config
        if self._ui_config_manager.should_load_service("powerbi"):
            try:
                self.powerbi = PowerBISettings()
                print(f"✓ Power BI configured: workspace={self.powerbi.workspace_id}, report={self.powerbi.report_id}")
            except Exception as e:
                print(f"⚠ Power BI not configured (service disabled): {e}")
                self.powerbi = None
        else:
            print("ℹ Power BI disabled by UI configuration")
            self.powerbi = None
    
    @property
    def ui_config(self):
        """Access the UI configuration manager"""
        return self._ui_config_manager

