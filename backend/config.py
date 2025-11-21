"""
Configuration management using Pydantic Settings.
Loads environment variables and provides validation.
"""
from pydantic import ConfigDict
from pydantic_settings import BaseSettings
from typing import List, Optional
from pathlib import Path
import logging

# Configure Azure SDK logging to be less verbose (globally)
# Suppress HTTP request/response logging from Azure SDKs
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
    logging.getLogger(logger_name).setLevel(logging.ERROR)

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
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",  # Vite default port
    ]
    
    # Optional: API Configuration
    API_TITLE: str = "Call Center AI Insights API"
    API_VERSION: str = "1.0.0"
    
    # Azure Cosmos DB Configuration
    COSMOS_DB_CONNECTION_STRING: Optional[str] = None
    COSMOS_DB_ACCOUNT_URI: Optional[str] = None  # For DefaultAzureCredential (e.g., https://your-account.documents.azure.com:443/)
    COSMOS_DB_DATABASE_NAME: str = "CallCenterAI"
    COSMOS_DB_SESSIONS_CONTAINER: str = "Sessions"
    COSMOS_DB_MESSAGES_CONTAINER: str = "Messages"
    
    # Copilot Studio Configuration
    copilot_studio: Optional[CopilotStudioSettings] = None
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        try:
            self.copilot_studio = CopilotStudioSettings()
            print(f"✓ Copilot Studio configured: environment_id={self.copilot_studio.environment_id}, schema_name={self.copilot_studio.schema_name}")
        except Exception as e:
            # Copilot Studio config is optional
            print(f"⚠ Copilot Studio not configured: {e}")
            pass
