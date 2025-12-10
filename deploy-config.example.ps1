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
