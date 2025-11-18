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
    --env-vars `
        "ENTRA_TENANT_ID=$EntraTenantId" `
        "ENTRA_CLIENT_ID=$EntraBackendClientId"

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
Write-Host "📝 Next Steps:" -ForegroundColor Yellow
Write-Host "1. Update your Entra ID app registrations:" -ForegroundColor White
Write-Host "   - Frontend app redirect URIs: $frontendUrl" -ForegroundColor White
Write-Host "   - Frontend app logout URL: $frontendUrl" -ForegroundColor White
Write-Host ""
Write-Host "2. Test your deployment:" -ForegroundColor White
Write-Host "   - Frontend: $frontendUrl" -ForegroundColor Cyan
Write-Host "   - Backend: $backendUrl/health" -ForegroundColor Cyan
Write-Host ""
Write-Host "See SETUP-SSO.md for complete configuration details." -ForegroundColor White
