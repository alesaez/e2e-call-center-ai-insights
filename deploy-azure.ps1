# Azure Container Apps Deployment Script
# This script deploys the application to Azure Container Apps

param(
    [Parameter(Mandatory=$true)]
    [string]$ResourceGroup = "demo-ai-insights-rg",
    
    [Parameter(Mandatory=$true)]
    [string]$Location = "centralus",
    
    [Parameter(Mandatory=$true)]
    [string]$ContainerRegistry = "demoaiinsightsacr",
    
    [Parameter(Mandatory=$true)]
    [string]$EntraFrontendClientId = "a3bab94c-ecd4-4fd3-a730-634adc687f20",
    
    [Parameter(Mandatory=$true)]
    [string]$EntraBackendClientId = "de3c9892-940f-4521-9e15-9e27267a3040",
    
    [Parameter(Mandatory=$true)]
    [string]$EntraTenantId = "211cfba1-9b0f-46aa-9e2d-478ed07f984e",
    
    # Optional: Cosmos DB for Chat History (if not provided, chat history will be disabled)
    [string]$CosmosDbAccountName = "",
    [string]$CosmosDbDatabaseName = "CallCenterAI",
    [string]$CosmosDbSessionsContainer = "Sessions",
    [string]$CosmosDbMessagesContainer = "Messages",
    
    [string]$EnvironmentName = "demoai-env",
    [string]$BackendAppName = "demoai-backend",
    [string]$FrontendAppName = "demoai-frontend"
)

Write-Host "=== Azure Container Apps Deployment ===" -ForegroundColor Cyan
Write-Host ""

# Login check
Write-Host "Checking Azure login status..." -ForegroundColor Green
$loginStatus = az account show 2>$null
if (-not $loginStatus) {
    Write-Host "Please login to Azure first:" -ForegroundColor Yellow
    az login
}

# Create resource group
Write-Host "Creating resource group: $ResourceGroup" -ForegroundColor Green
az group create --name $ResourceGroup --location $Location

# Create Cosmos DB account (if specified)
$cosmosDbUri = ""
if ($CosmosDbAccountName) {
    Write-Host "Creating Cosmos DB account: $CosmosDbAccountName" -ForegroundColor Green
    az cosmosdb create `
        --name $CosmosDbAccountName `
        --resource-group $ResourceGroup `
        --location $Location `
        --default-consistency-level "Session" `
        --enable-automatic-failover false
    
    # Create database and containers
    Write-Host "Creating Cosmos DB database and containers..." -ForegroundColor Green
    az cosmosdb sql database create `
        --account-name $CosmosDbAccountName `
        --resource-group $ResourceGroup `
        --name $CosmosDbDatabaseName
    
    # Create Sessions container (partitioned by userId)
    az cosmosdb sql container create `
        --account-name $CosmosDbAccountName `
        --resource-group $ResourceGroup `
        --database-name $CosmosDbDatabaseName `
        --name $CosmosDbSessionsContainer `
        --partition-key-path "/userId" `
        --throughput 400
    
    # Create Messages container (partitioned by sessionId)
    az cosmosdb sql container create `
        --account-name $CosmosDbAccountName `
        --resource-group $ResourceGroup `
        --database-name $CosmosDbDatabaseName `
        --name $CosmosDbMessagesContainer `
        --partition-key-path "/sessionId" `
        --throughput 400
    
    # Get Cosmos DB URI
    $cosmosDbUri = "https://$CosmosDbAccountName.documents.azure.com:443/"
    Write-Host "Cosmos DB URI: $cosmosDbUri" -ForegroundColor Cyan
}

# Create Container Apps environment
Write-Host "Creating Container Apps environment: $EnvironmentName" -ForegroundColor Green
az containerapp env create `
    --name $EnvironmentName `
    --resource-group $ResourceGroup `
    --location $Location

# Build and push backend image
Write-Host ""
Write-Host "Building and pushing backend image..." -ForegroundColor Green
Push-Location backend
az acr build `
    --registry $ContainerRegistry `
    --image demoai-backend:latest `
    --file Dockerfile `
    .
Pop-Location

# Prepare environment variables for backend
$backendEnvVars = @(
    "ENTRA_TENANT_ID=$EntraTenantId"
    "ENTRA_CLIENT_ID=$EntraBackendClientId"
)

# Add Cosmos DB environment variables if Cosmos DB is configured
if ($CosmosDbAccountName) {
    $backendEnvVars += @(
        "COSMOS_DB_ACCOUNT_URI=$cosmosDbUri"
        "COSMOS_DB_DATABASE_NAME=$CosmosDbDatabaseName"
        "COSMOS_DB_SESSIONS_CONTAINER=$CosmosDbSessionsContainer"
        "COSMOS_DB_MESSAGES_CONTAINER=$CosmosDbMessagesContainer"
    )
}

# Deploy backend container app
Write-Host ""
Write-Host "Deploying backend container app..." -ForegroundColor Green
az containerapp create `
    --name $BackendAppName `
    --resource-group $ResourceGroup `
    --environment $EnvironmentName `
    --image "$ContainerRegistry.azurecr.io/demoai-backend:latest" `
    --target-port 8000 `
    --ingress external `
    --registry-server "$ContainerRegistry.azurecr.io" `
    --cpu 0.5 `
    --memory 1Gi `
    --env-vars ($backendEnvVars -join " ")

# Configure managed identity for Cosmos DB access (if Cosmos DB is used)
if ($CosmosDbAccountName) {
    Write-Host "Configuring managed identity for Cosmos DB access..." -ForegroundColor Green
    
    # Enable system-assigned managed identity
    az containerapp identity assign `
        --name $BackendAppName `
        --resource-group $ResourceGroup `
        --system-assigned
    
    # Get the managed identity principal ID
    $principalId = az containerapp identity show `
        --name $BackendAppName `
        --resource-group $ResourceGroup `
        --query "principalId" `
        --output tsv
    
    # Assign Cosmos DB Contributor role to the managed identity
    $cosmosDbResourceId = "/subscriptions/$(az account show --query id -o tsv)/resourceGroups/$ResourceGroup/providers/Microsoft.DocumentDB/databaseAccounts/$CosmosDbAccountName"
    az role assignment create `
        --assignee $principalId `
        --role "Cosmos DB Built-in Data Contributor" `
        --scope $cosmosDbResourceId
}

# Get backend URL
$backendUrl = az containerapp show `
    --name $BackendAppName `
    --resource-group $ResourceGroup `
    --query "properties.configuration.ingress.fqdn" `
    --output tsv

$backendUrl = "https://$backendUrl"
Write-Host "Backend URL: $backendUrl" -ForegroundColor Cyan

# Build and push frontend image
Write-Host ""
Write-Host "Building and pushing frontend image..." -ForegroundColor Green
Push-Location frontend

# Create build args file
$buildArgs = @"
VITE_ENTRA_CLIENT_ID=$EntraFrontendClientId
VITE_ENTRA_TENANT_ID=$EntraTenantId
VITE_API_SCOPE=api://$EntraBackendClientId/access_as_user
"@

az acr build `
    --registry $ContainerRegistry `
    --image demoai-frontend:latest `
    --file Dockerfile `
    --build-arg "VITE_ENTRA_CLIENT_ID=$EntraFrontendClientId" `
    --build-arg "VITE_ENTRA_TENANT_ID=$EntraTenantId" `
    --build-arg "VITE_API_SCOPE=api://$EntraBackendClientId/access_as_user" `
    .
Pop-Location

# Deploy frontend container app
Write-Host ""
Write-Host "Deploying frontend container app..." -ForegroundColor Green
az containerapp create `
    --name $FrontendAppName `
    --resource-group $ResourceGroup `
    --environment $EnvironmentName `
    --image "$ContainerRegistry.azurecr.io/demoai-frontend:latest" `
    --target-port 80 `
    --ingress external `
    --registry-server "$ContainerRegistry.azurecr.io" `
    --cpu 0.5 `
    --memory 1Gi

# Get frontend URL
$frontendUrl = az containerapp show `
    --name $FrontendAppName `
    --resource-group $ResourceGroup `
    --query "properties.configuration.ingress.fqdn" `
    --output tsv

$frontendUrl = "https://$frontendUrl"
Write-Host "Frontend URL: $frontendUrl" -ForegroundColor Cyan

# Update backend CORS
Write-Host ""
Write-Host "Updating backend CORS settings..." -ForegroundColor Green
az containerapp update `
    --name $BackendAppName `
    --resource-group $ResourceGroup `
    --set-env-vars "ALLOWED_ORIGINS=[`"$frontendUrl`"]"

# Summary
Write-Host ""
Write-Host "=== Deployment Complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Deployed Resources:" -ForegroundColor Yellow
Write-Host "   - Frontend App: $frontendUrl" -ForegroundColor Cyan
Write-Host "   - Backend API: $backendUrl" -ForegroundColor Cyan
if ($CosmosDbAccountName) {
    Write-Host "   - Cosmos DB: $cosmosDbUri" -ForegroundColor Cyan
    Write-Host "   - Database: $CosmosDbDatabaseName" -ForegroundColor White
    Write-Host "   - Sessions Container: $CosmosDbSessionsContainer (partitioned by userId)" -ForegroundColor White
    Write-Host "   - Messages Container: $CosmosDbMessagesContainer (partitioned by sessionId)" -ForegroundColor White
    Write-Host "   ✅ Managed Identity configured for Cosmos DB access" -ForegroundColor Green
} else {
    Write-Host "   ⚠️ Cosmos DB not configured - chat history will be disabled" -ForegroundColor Yellow
}
Write-Host ""
Write-Host "📝 Next Steps:" -ForegroundColor Yellow
Write-Host "1. Update your Entra ID app registrations:" -ForegroundColor White
Write-Host "   - Frontend app redirect URIs: $frontendUrl" -ForegroundColor White
Write-Host "   - Frontend app logout URL: $frontendUrl" -ForegroundColor White
Write-Host ""
Write-Host "2. Test your deployment:" -ForegroundColor White
Write-Host "   - Frontend: $frontendUrl" -ForegroundColor Cyan
Write-Host "   - Backend Health: $backendUrl/health" -ForegroundColor Cyan
if ($CosmosDbAccountName) {
    Write-Host "   - Chat History: Test chat functionality in the app" -ForegroundColor Cyan
}
Write-Host ""
Write-Host "📚 Documentation:" -ForegroundColor Yellow
Write-Host "   - Setup Guide: SETUP-SSO.md" -ForegroundColor White
Write-Host "   - Chat History: CHAT-HISTORY.md" -ForegroundColor White
Write-Host "   - Architecture: ARCHITECTURE.md" -ForegroundColor White
Write-Host ""
if ($CosmosDbAccountName) {
    Write-Host "💡 Cosmos DB Features Available:" -ForegroundColor Green
    Write-Host "   ✅ Persistent chat history" -ForegroundColor White
    Write-Host "   ✅ User-scoped conversations" -ForegroundColor White
    Write-Host "   ✅ Error resilience and retry logic" -ForegroundColor White
    Write-Host "   ✅ Two-container optimized architecture" -ForegroundColor White
    Write-Host "   ✅ Managed identity authentication" -ForegroundColor White
}
