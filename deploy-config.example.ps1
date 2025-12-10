# Example deployment configuration file
# Copy this file to deploy-config.ps1 and fill in your values
# deploy-config.ps1 is ignored by git and will not be committed

# Microsoft Entra ID Configuration
$EntraFrontendClientId = "YOUR_FRONTEND_CLIENT_ID_HERE"
$EntraBackendClientId = "YOUR_BACKEND_CLIENT_ID_HERE"
$EntraTenantId = "YOUR_TENANT_ID_HERE"

# Copilot Studio Configuration (optional)
$CopilotStudioClientSecret = "YOUR_COPILOT_STUDIO_CLIENT_SECRET_HERE"
$CopilotStudioEnvironmentId = "YOUR_COPILOT_STUDIO_ENVIRONMENT_ID_HERE"
$CopilotStudioSchemaName = "YOUR_COPILOT_STUDIO_SCHEMA_NAME_HERE"

# AI Foundry Configuration
$AiFoundryClientSecret = "YOUR_AI_FOUNDRY_CLIENT_SECRET_HERE"

# Tenant Branding Configuration (White Labeling)
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