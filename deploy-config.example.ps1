# Example deployment configuration file
# Copy this file to deploy-config.ps1 and fill in your values
# deploy-config.ps1 is ignored by git and will not be committed

# ============================================================================
# REQUIRED: Microsoft Entra ID Configuration
# ============================================================================
$EntraFrontendClientId = "YOUR_FRONTEND_CLIENT_ID_HERE"
$EntraBackendClientId = "YOUR_BACKEND_CLIENT_ID_HERE"
$EntraTenantId = "YOUR_TENANT_ID_HERE"

# ============================================================================
# OPTIONAL: Copilot Studio Configuration
# ============================================================================
$CopilotStudioClientSecret = "YOUR_COPILOT_STUDIO_CLIENT_SECRET_HERE"
$CopilotStudioEnvironmentId = "YOUR_COPILOT_STUDIO_ENVIRONMENT_ID_HERE"
$CopilotStudioSchemaName = "YOUR_COPILOT_STUDIO_SCHEMA_NAME_HERE"

# ============================================================================
# Resource Configuration (Defaults provided, customize as needed)
# ============================================================================
$ResourceGroup = "demo-ai-insights-rg"
$Location = "eastus2"
$ContainerRegistry = "demoaiinsightsacr"
$KeyVaultName = "demoai-kv"

# ============================================================================
# REQUIRED: AI Foundry Configuration
# ============================================================================
$AiFoundryAccountName = "demo-ai-insights-foundry"
$AiFoundryProjectName = "demo-ai-project"
$AiFoundryAgentName = "CallCenterAgent"
$AiFoundryAgentId = ""  # Leave empty to be prompted during deployment
$AiFoundryClientSecret = "YOUR_AI_FOUNDRY_CLIENT_SECRET_HERE"

# ============================================================================
# Cosmos DB Configuration (Optional - for chat history)
# ============================================================================
$CosmosDbAccountName = "demo-ai-insights-cosmosdb"
$CosmosDbDatabaseName = "CallCenterAI"
$CosmosDbSessionsContainer = "Sessions"
$CosmosDbMessagesContainer = "Messages"

# ============================================================================
# Container Apps Configuration
# ============================================================================
$EnvironmentName = "demoai-env"
$BackendAppName = "demoai-backend"
$FrontendAppName = "demoai-frontend"
$minReplicas = 1
$maxReplicas = 10

# ============================================================================
# Application Insights Configuration
# ============================================================================
# Application Insights is automatically created and linked to Log Analytics
# during infrastructure provisioning. The connection string is auto-detected
# and passed to the backend container.
$AppInsightsName = "demoai-appinsights"

# Override: Provide a connection string manually (skips auto-detection).
# Useful when running -CodeOnly without prior infra provisioning.
$ApplicationInsightsConnectionString = ""

# ============================================================================
# Network Security Configuration
# ============================================================================
$VNetName = "demoai-vnet"
$VNetAddressPrefix = "10.0.0.0/16"
$ContainerAppsSubnetName = "containerapps-subnet"
$ContainerAppsSubnetPrefix = "10.0.0.0/23"
$PrivateEndpointsSubnetName = "privateendpoints-subnet"
$PrivateEndpointsSubnetPrefix = "10.0.2.0/24"

# ============================================================================
# Tenant Branding Configuration (White Labeling)
# ============================================================================
# Customize the application appearance per tenant
$VITE_TENANT_ID="default"
$VITE_TENANT_NAME="Call Center AI Insights"

# Logo Configuration
# Use EITHER logo path (relative to public folder) OR logo URL (external)
# VITE_TENANT_LOGO_PATH=logo.png
$VITE_TENANT_LOGO_URL=""

# Favicon Configuration
# Path relative to public folder or external URL
$VITE_TENANT_FAVICON_URL=""

# Theme Colors (hex format)
$VITE_TENANT_PRIMARY_COLOR='#0078d4'
$VITE_TENANT_SECONDARY_COLOR='#2b88d8'

# ============================================================================
# OPTIONAL: Power BI Configuration (uses On-Behalf-Of flow)
# ============================================================================
# The backend uses OBO flow to access Power BI with user's permissions
# This requires the backend app registration to have Power BI API delegated permissions
# Users must have Power BI access to view reports through the app

# Power BI Tenant ID (usually same as EntraTenantId)
$PowerBITenantId = ""

# Backend app registration client ID (same as EntraBackendClientId for OBO flow)
$PowerBIClientId = ""

# Backend app registration client secret (same as backend secret for OBO flow)
$PowerBIClientSecret = ""

# Power BI workspace (group) ID where your report is located
# Get this from Power BI workspace URL: https://app.powerbi.com/groups/{WORKSPACE_ID}/...
$PowerBIWorkspaceId = ""

# Power BI report ID to embed
# Get this from Power BI report URL or File > Embed report
$PowerBIReportId = ""
