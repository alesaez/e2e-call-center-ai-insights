# Azure Container Apps Deployment Script with Enhanced Network Security
# This script deploys the application to Azure Container Apps with the following security architecture:
#
# Network Isolation:
#   - Virtual Network with dedicated subnets for Container Apps and Private Endpoints
#   - Backend API with internal ingress only (not publicly accessible)
#   - Frontend with external ingress (public-facing)
#
# Private Endpoints (no public access):
#   - Azure Container Registry (Premium SKU required)
#   - Azure Key Vault
#   - Azure Cosmos DB (if enabled)
#
# AI Services:
#   - Copilot Studio (optional) - for conversational AI agents
#   - Azure AI Foundry (optional) - Hub and Project creation with managed identity access
#     Note: Agent creation is done via Azure AI Studio UI after deployment
#
# Security Features:
#   - Managed Identity for secure authentication
#   - RBAC-based authorization
#   - Private DNS zones for name resolution
#   - Secrets stored in Key Vault (not environment variables)
#
# Traffic Flow:
#   Internet → Frontend (Public) → Backend (Internal) → Private Endpoints → Azure Services

param(
    # Deployment Mode Configuration
    [switch]$InfraOnly,  # If true, only deploy infrastructure (no code build/deploy)
    [switch]$CodeOnly    # If true, only build and deploy code (skip infrastructure)
)

# Load configuration from deploy-config.ps1
$configPath = Join-Path $PSScriptRoot "deploy-config.ps1"
if (Test-Path $configPath) {
    Write-Host "Loading configuration from deploy-config.ps1..." -ForegroundColor Cyan
    . $configPath
    Write-Host "   ✅ Configuration loaded" -ForegroundColor Green
} else {
    Write-Host "❌ deploy-config.ps1 not found" -ForegroundColor Red
    Write-Host "   Copy deploy-config.example.ps1 to deploy-config.ps1 and fill in your values" -ForegroundColor White
    Write-Host ""
    exit 1
}

# Set defaults for optional parameters if not defined in config
if (-not (Get-Variable -Name "ResourceGroup" -ErrorAction SilentlyContinue)) {
    $ResourceGroup = "demo-ai-insights-rg"
}
if (-not (Get-Variable -Name "Location" -ErrorAction SilentlyContinue)) {
    $Location = "eastus2"
}
if (-not (Get-Variable -Name "ContainerRegistry" -ErrorAction SilentlyContinue)) {
    $ContainerRegistry = "demoaiinsightsacr"
}
if (-not (Get-Variable -Name "KeyVaultName" -ErrorAction SilentlyContinue)) {
    $KeyVaultName = "demoai-kv"
}
if (-not (Get-Variable -Name "CosmosDbAccountName" -ErrorAction SilentlyContinue)) {
    $CosmosDbAccountName = "demo-ai-insights-cosmosdb"
}
if (-not (Get-Variable -Name "CosmosDbDatabaseName" -ErrorAction SilentlyContinue)) {
    $CosmosDbDatabaseName = "CallCenterAI"
}
if (-not (Get-Variable -Name "CosmosDbSessionsContainer" -ErrorAction SilentlyContinue)) {
    $CosmosDbSessionsContainer = "Sessions"
}
if (-not (Get-Variable -Name "CosmosDbMessagesContainer" -ErrorAction SilentlyContinue)) {
    $CosmosDbMessagesContainer = "Messages"
}
if (-not (Get-Variable -Name "AiFoundryAccountName" -ErrorAction SilentlyContinue)) {
    $AiFoundryAccountName = "demo-ai-insights-foundry"
}
if (-not (Get-Variable -Name "AiFoundryProjectName" -ErrorAction SilentlyContinue)) {
    $AiFoundryProjectName = "demo-ai-project"
}
if (-not (Get-Variable -Name "AiFoundryAgentName" -ErrorAction SilentlyContinue)) {
    $AiFoundryAgentName = "CallCenterAgent"
}
if (-not (Get-Variable -Name "EnvironmentName" -ErrorAction SilentlyContinue)) {
    $EnvironmentName = "demoai-env"
}
if (-not (Get-Variable -Name "BackendAppName" -ErrorAction SilentlyContinue)) {
    $BackendAppName = "demoai-backend"
}
if (-not (Get-Variable -Name "FrontendAppName" -ErrorAction SilentlyContinue)) {
    $FrontendAppName = "demoai-frontend"
}
if (-not (Get-Variable -Name "VNetName" -ErrorAction SilentlyContinue)) {
    $VNetName = "demoai-vnet"
}
if (-not (Get-Variable -Name "VNetAddressPrefix" -ErrorAction SilentlyContinue)) {
    $VNetAddressPrefix = "10.0.0.0/16"
}
if (-not (Get-Variable -Name "ContainerAppsSubnetName" -ErrorAction SilentlyContinue)) {
    $ContainerAppsSubnetName = "containerapps-subnet"
}
if (-not (Get-Variable -Name "ContainerAppsSubnetPrefix" -ErrorAction SilentlyContinue)) {
    $ContainerAppsSubnetPrefix = "10.0.0.0/23"
}
if (-not (Get-Variable -Name "PrivateEndpointsSubnetName" -ErrorAction SilentlyContinue)) {
    $PrivateEndpointsSubnetName = "privateendpoints-subnet"
}
if (-not (Get-Variable -Name "PrivateEndpointsSubnetPrefix" -ErrorAction SilentlyContinue)) {
    $PrivateEndpointsSubnetPrefix = "10.0.2.0/24"
}

# Set defaults for optional secrets (empty strings)
if (-not (Get-Variable -Name "EntraFrontendClientId" -ErrorAction SilentlyContinue)) {
    $EntraFrontendClientId = ""
}
if (-not (Get-Variable -Name "EntraBackendClientId" -ErrorAction SilentlyContinue)) {
    $EntraBackendClientId = ""
}
if (-not (Get-Variable -Name "EntraTenantId" -ErrorAction SilentlyContinue)) {
    $EntraTenantId = ""
}
if (-not (Get-Variable -Name "CopilotStudioClientSecret" -ErrorAction SilentlyContinue)) {
    $CopilotStudioClientSecret = ""
}
if (-not (Get-Variable -Name "CopilotStudioEnvironmentId" -ErrorAction SilentlyContinue)) {
    $CopilotStudioEnvironmentId = ""
}
if (-not (Get-Variable -Name "CopilotStudioSchemaName" -ErrorAction SilentlyContinue)) {
    $CopilotStudioSchemaName = ""
}
if (-not (Get-Variable -Name "AiFoundryClientSecret" -ErrorAction SilentlyContinue)) {
    $AiFoundryClientSecret = ""
}
if (-not (Get-Variable -Name "PowerBITenantId" -ErrorAction SilentlyContinue)) {
    $PowerBITenantId = ""
}
if (-not (Get-Variable -Name "PowerBIClientId" -ErrorAction SilentlyContinue)) {
    $PowerBIClientId = ""
}
if (-not (Get-Variable -Name "PowerBIClientSecret" -ErrorAction SilentlyContinue)) {
    $PowerBIClientSecret = ""
}
if (-not (Get-Variable -Name "PowerBIWorkspaceId" -ErrorAction SilentlyContinue)) {
    $PowerBIWorkspaceId = ""
}
if (-not (Get-Variable -Name "PowerBIReportId" -ErrorAction SilentlyContinue)) {
    $PowerBIReportId = ""
}

# Validate required sensitive parameters
$missingParams = @()
if ([string]::IsNullOrEmpty($EntraFrontendClientId)) { $missingParams += "EntraFrontendClientId" }
if ([string]::IsNullOrEmpty($EntraBackendClientId)) { $missingParams += "EntraBackendClientId" }
if ([string]::IsNullOrEmpty($EntraTenantId)) { $missingParams += "EntraTenantId" }

if ($missingParams.Count -gt 0) {
    Write-Host "❌ Error: Missing required parameters:" -ForegroundColor Red
    $missingParams | ForEach-Object { Write-Host "   - $_" -ForegroundColor Red }
    Write-Host ""
    Write-Host "Please provide these parameters either:" -ForegroundColor Yellow
    Write-Host "   1. Via command line: .\deploy-azure.ps1 -EntraTenantId 'xxx' -EntraFrontendClientId 'yyy' ..." -ForegroundColor White
    Write-Host "   2. In deploy-config.ps1 file (copy from deploy-config.example.ps1)" -ForegroundColor White
    exit 1
}

az config set core.only_show_errors=$true

# Validate deployment mode
if ($InfraOnly -and $CodeOnly) {
    Write-Host "Error: Cannot specify both -InfraOnly and -CodeOnly" -ForegroundColor Red
    exit 1
}

Write-Host "=== Azure Container Apps Deployment with Private Endpoints ===" -ForegroundColor Cyan
Write-Host ""

$managedIdentityName = "$ResourceGroup-identity"

# Display deployment mode
if ($InfraOnly) {
    Write-Host "🔧 Deployment Mode: Infrastructure Only" -ForegroundColor Yellow
    Write-Host "   - Will deploy all infrastructure resources" -ForegroundColor White
    Write-Host "   - Will skip code build and container deployment" -ForegroundColor White
    Write-Host ""
}
elseif ($CodeOnly) {
    Write-Host "📦 Deployment Mode: Code Only" -ForegroundColor Yellow
    Write-Host "   - Will skip infrastructure provisioning" -ForegroundColor White
    Write-Host "   - Will build images and deploy containers" -ForegroundColor White
    Write-Host ""
}
else {
    Write-Host "🚀 Deployment Mode: Full Deployment" -ForegroundColor Yellow
    Write-Host "   - Will deploy infrastructure and code" -ForegroundColor White
    Write-Host ""
}

# Login check
Write-Host "Checking Azure login status..." -ForegroundColor Green
$loginStatus = az account show 2>$null
if (-not $loginStatus) {
    Write-Host "Please login to Azure first:" -ForegroundColor Yellow
    az login
}

# Infrastructure provisioning
if (-not $CodeOnly) {
    Write-Host ""
    Write-Host "=== Provisioning Infrastructure ===" -ForegroundColor Cyan
    Write-Host ""
    
    # Create resource group
    Write-Host "Checking resource group: $ResourceGroup" -ForegroundColor Green
    $rgExists = az group exists --name $ResourceGroup --output tsv
    if ($rgExists -eq "false") {
        Write-Host "Creating resource group: $ResourceGroup" -ForegroundColor Yellow
        az group create --name $ResourceGroup --location $Location | Out-Null
        Write-Host "   ✅ Resource group created" -ForegroundColor Green
    } else {
        Write-Host "   ✅ Resource group already exists" -ForegroundColor Cyan
    }

    # Create User-Assigned Managed Identity for Container Apps
    Write-Host ""
    Write-Host "Checking User-Assigned Managed Identity..." -ForegroundColor Green
    
    # Use list command to check if identity exists
    $managedIdentityExists = az identity list `
        --resource-group $ResourceGroup `
        --query "[?name=='$managedIdentityName'].id | [0]" `
        --output tsv 2>$null
    
    if (-not $managedIdentityExists) {
        Write-Host "Creating User-Assigned Managed Identity..." -ForegroundColor Yellow
        az identity create `
            --name $managedIdentityName `
            --resource-group $ResourceGroup `
            --location $Location | Out-Null
        Write-Host "   ✅ User-Assigned Managed Identity created" -ForegroundColor Green
    } else {
        Write-Host "   ✅ User-Assigned Managed Identity already exists" -ForegroundColor Cyan
    }
    
    # Get the managed identity details
    $managedIdentityId = az identity show `
        --name $managedIdentityName `
        --resource-group $ResourceGroup `
        --query "id" `
        --output tsv
    
    $managedIdentityPrincipalId = az identity show `
        --name $managedIdentityName `
        --resource-group $ResourceGroup `
        --query "principalId" `
        --output tsv
    
    $managedIdentityClientId = az identity show `
        --name $managedIdentityName `
        --resource-group $ResourceGroup `
        --query "clientId" `
        --output tsv
    
    Write-Host "Managed Identity Resource ID: $managedIdentityId" -ForegroundColor Cyan
    Write-Host "Managed Identity Principal ID: $managedIdentityPrincipalId" -ForegroundColor Cyan
    Write-Host "Managed Identity Client ID: $managedIdentityClientId" -ForegroundColor Cyan

    # Create Virtual Network
    Write-Host ""
    Write-Host "Checking Virtual Network: $VNetName" -ForegroundColor Green
    # Use list command to check if VNet exists
    $vnetExists = az network vnet list `
        --resource-group $ResourceGroup `
        --query "[?name=='$VNetName'].id | [0]" `
        --output tsv 2>$null
    
    if (-not $vnetExists) {
        Write-Host "Creating Virtual Network for private connectivity..." -ForegroundColor Yellow
        az network vnet create `
            --name $VNetName `
            --resource-group $ResourceGroup `
            --location $Location `
            --address-prefix $VNetAddressPrefix | Out-Null
        Write-Host "   ✅ Virtual Network created" -ForegroundColor Green
    } else {
        Write-Host "   ✅ Virtual Network already exists" -ForegroundColor Cyan
    }

    # Create subnet for Container Apps with delegation
    Write-Host "Checking Container Apps subnet..." -ForegroundColor Green
    # Use list command to check if subnet exists
    $containerAppsSubnetExists = az network vnet subnet list `
        --resource-group $ResourceGroup `
        --vnet-name $VNetName `
        --query "[?name=='$ContainerAppsSubnetName'].id | [0]" `
        --output tsv 2>$null
    
    if (-not $containerAppsSubnetExists) {
        Write-Host "Creating Container Apps subnet with delegation..." -ForegroundColor Yellow
        az network vnet subnet create `
            --name $ContainerAppsSubnetName `
            --resource-group $ResourceGroup `
            --vnet-name $VNetName `
            --address-prefix $ContainerAppsSubnetPrefix `
            --delegations "Microsoft.App/environments" | Out-Null
        Write-Host "   ✅ Container Apps subnet created" -ForegroundColor Green
    } else {
        Write-Host "   ✅ Container Apps subnet already exists" -ForegroundColor Cyan
    }

    # Create subnet for Private Endpoints
    Write-Host "Checking Private Endpoints subnet..." -ForegroundColor Green
    # Use list command to check if subnet exists
    $privateEndpointsSubnetExists = az network vnet subnet list `
        --resource-group $ResourceGroup `
        --vnet-name $VNetName `
        --query "[?name=='$PrivateEndpointsSubnetName'].id | [0]" `
        --output tsv 2>$null
    
    if (-not $privateEndpointsSubnetExists) {
        Write-Host "Creating Private Endpoints subnet..." -ForegroundColor Yellow
        az network vnet subnet create `
            --name $PrivateEndpointsSubnetName `
            --resource-group $ResourceGroup `
            --vnet-name $VNetName `
            --address-prefix $PrivateEndpointsSubnetPrefix | Out-Null
        Write-Host "   ✅ Private Endpoints subnet created" -ForegroundColor Green
        
        # Disable private endpoint network policies on the subnet
        az network vnet subnet update `
            --name $PrivateEndpointsSubnetName `
            --resource-group $ResourceGroup `
            --vnet-name $VNetName `
            --disable-private-endpoint-network-policies true | Out-Null
    } else {
        Write-Host "   ✅ Private Endpoints subnet already exists" -ForegroundColor Cyan
        
        # Ensure network policies are disabled (idempotent operation)
        az network vnet subnet update `
            --name $PrivateEndpointsSubnetName `
            --resource-group $ResourceGroup `
            --vnet-name $VNetName `
            --disable-private-endpoint-network-policies true | Out-Null
    }

    Write-Host "Virtual Network configured: $VNetName" -ForegroundColor Cyan
    Write-Host "   - Container Apps Subnet: $ContainerAppsSubnetPrefix" -ForegroundColor White
    Write-Host "   - Private Endpoints Subnet: $PrivateEndpointsSubnetPrefix" -ForegroundColor White

    # Get subnet IDs for later use
    $containerAppsSubnetId = az network vnet subnet show `
        --name $ContainerAppsSubnetName `
        --resource-group $ResourceGroup `
        --vnet-name $VNetName `
        --query "id" `
        --output tsv

    $privateEndpointsSubnetId = az network vnet subnet show `
        --name $PrivateEndpointsSubnetName `
        --resource-group $ResourceGroup `
        --vnet-name $VNetName `
        --query "id" `
        --output tsv

    # Create Container Registry with Premium SKU (required for private endpoints)
    Write-Host ""
    Write-Host "Checking Azure Container Registry: $ContainerRegistry" -ForegroundColor Green
    # Use list command to check if ACR exists
    $acrExists = az acr list `
        --resource-group $ResourceGroup `
        --query "[?name=='$ContainerRegistry'].id | [0]" `
        --output tsv 2>$null
    
    if (-not $acrExists) {
        Write-Host "Creating Azure Container Registry..." -ForegroundColor Yellow
        az acr create `
            --name $ContainerRegistry `
            --resource-group $ResourceGroup `
            --location $Location `
            --sku Premium `
            --admin-enabled false | Out-Null
        Write-Host "   ✅ Container Registry created" -ForegroundColor Green
        
        # Adding IPs from Azure Container Registry East US 2
        Write-Host "   Configuring network rules..." -ForegroundColor Yellow
        az acr network-rule add -n $ContainerRegistry --ip-address 20.44.19.64/26 | Out-Null
        az acr network-rule add -n $ContainerRegistry --ip-address 20.44.22.0/24 | Out-Null
        az acr network-rule add -n $ContainerRegistry --ip-address 20.44.23.0/24 | Out-Null
        az acr network-rule add -n $ContainerRegistry --ip-address 20.49.102.128/26 | Out-Null
        az acr network-rule add -n $ContainerRegistry --ip-address 20.65.0.0/24 | Out-Null
        az acr network-rule add -n $ContainerRegistry --ip-address 40.70.146.88/29 | Out-Null
        az acr network-rule add -n $ContainerRegistry --ip-address 40.70.150.0/24 | Out-Null
        az acr network-rule add -n $ContainerRegistry --ip-address 52.167.106.80/29 | Out-Null
        az acr network-rule add -n $ContainerRegistry --ip-address 52.167.110.0/24 | Out-Null
        az acr network-rule add -n $ContainerRegistry --ip-address 52.167.111.0/26 | Out-Null
        az acr network-rule add -n $ContainerRegistry --ip-address 104.208.144.80/29 | Out-Null
        az acr network-rule add -n $ContainerRegistry --ip-address 104.208.200.0/23 | Out-Null
        az acr network-rule add -n $ContainerRegistry --ip-address 172.210.216.64/26 | Out-Null
        az acr network-rule add -n $ContainerRegistry --ip-address 172.210.218.0/25 | Out-Null
        Write-Host "   ✅ Network rules configured" -ForegroundColor Green
    } else {
        Write-Host "   ✅ Container Registry already exists" -ForegroundColor Cyan
    }

    Write-Host "Container Registry: $ContainerRegistry.azurecr.io (Private)" -ForegroundColor Cyan

    # Grant ACR Pull permissions to the user-assigned managed identity
    Write-Host "Granting ACR Pull permissions to managed identity..." -ForegroundColor Green
    $acrResourceId = "/subscriptions/$(az account show --query id -o tsv)/resourceGroups/$ResourceGroup/providers/Microsoft.ContainerRegistry/registries/$ContainerRegistry"
    
    $existingAcrAssignment = az role assignment list `
        --assignee $managedIdentityClientId `
        --role "AcrPull" `
        --scope $acrResourceId `
        --query "[0].id" `
        --output tsv 2>$null
    
    if (-not $existingAcrAssignment) {
        az role assignment create `
            --assignee $managedIdentityClientId `
            --role "AcrPull" `
            --scope $acrResourceId | Out-Null
        Write-Host "   ✅ ACR Pull role assigned to managed identity" -ForegroundColor Green
    } else {
        Write-Host "   ✅ ACR Pull role already assigned" -ForegroundColor Cyan
    }

    # Create Private Endpoint for Container Registry
    Write-Host "Checking Private Endpoint for Container Registry..." -ForegroundColor Green
    $acrPeExists = az network private-endpoint show `
        --name "$ContainerRegistry-pe" `
        --resource-group $ResourceGroup `
        --query "id" `
        --output tsv 2>$null
    
    if (-not $acrPeExists) {
        Write-Host "Creating Private Endpoint for Container Registry..." -ForegroundColor Yellow
        az network private-endpoint create `
            --name "$ContainerRegistry-pe" `
            --resource-group $ResourceGroup `
            --location $Location `
            --subnet $privateEndpointsSubnetId `
            --private-connection-resource-id "/subscriptions/$(az account show --query id -o tsv)/resourceGroups/$ResourceGroup/providers/Microsoft.ContainerRegistry/registries/$ContainerRegistry" `
            --group-id registry `
            --connection-name "$ContainerRegistry-connection" | Out-Null
        Write-Host "   ✅ Private Endpoint created" -ForegroundColor Green
    } else {
        Write-Host "   ✅ Private Endpoint already exists" -ForegroundColor Cyan
    }

    # Create Private DNS Zone for ACR
    Write-Host "Configuring Private DNS for Container Registry..." -ForegroundColor Green
    
    # Check if DNS zone exists
    $acrDnsZoneExists = az network private-dns zone show `
        --resource-group $ResourceGroup `
        --name "privatelink.azurecr.io" `
        --query "id" `
        --output tsv 2>$null
    
    if (-not $acrDnsZoneExists) {
        az network private-dns zone create `
            --resource-group $ResourceGroup `
            --name "privatelink.azurecr.io" | Out-Null
        Write-Host "   ✅ Private DNS Zone created" -ForegroundColor Green
    }

    # Check if VNet link exists
    $acrVnetLinkExists = az network private-dns link vnet show `
        --resource-group $ResourceGroup `
        --zone-name "privatelink.azurecr.io" `
        --name "acr-dns-link" `
        --query "id" `
        --output tsv 2>$null
    
    if (-not $acrVnetLinkExists) {
        az network private-dns link vnet create `
            --resource-group $ResourceGroup `
            --zone-name "privatelink.azurecr.io" `
            --name "acr-dns-link" `
            --virtual-network $VNetName `
            --registration-enabled false | Out-Null
        Write-Host "   ✅ VNet link created" -ForegroundColor Green
    }

    # Get the DNS zone ID
    $acrDnsZoneId = az network private-dns zone show `
        --resource-group $ResourceGroup `
        --name "privatelink.azurecr.io" `
        --query "id" `
        --output tsv

    # Create DNS zone group for automatic DNS record management
    Write-Host "Configuring DNS zone group for ACR..." -ForegroundColor Green
    az network private-endpoint dns-zone-group create `
        --resource-group $ResourceGroup `
        --endpoint-name "$ContainerRegistry-pe" `
        --name "acr-dns-zone-group" `
        --private-dns-zone $acrDnsZoneId `
        --zone-name "privatelink.azurecr.io" | Out-Null
    
    Write-Host "   ✅ ACR Private Endpoint DNS configured" -ForegroundColor Green

    # Create Key Vault with network restrictions
    Write-Host ""
    Write-Host "Checking Azure Key Vault: $KeyVaultName" -ForegroundColor Green
    # Use list command to check if Key Vault exists
    $kvExists = az keyvault list `
        --resource-group $ResourceGroup `
        --query "[?name=='$KeyVaultName'].id | [0]" `
        --output tsv 2>$null
    
    if (-not $kvExists) {
        Write-Host "Creating Azure Key Vault..." -ForegroundColor Yellow
        az keyvault create `
            --name $KeyVaultName `
            --resource-group $ResourceGroup `
            --location $Location `
            --enable-rbac-authorization true `
            --public-network-access Disabled | Out-Null
        Write-Host "   ✅ Key Vault created" -ForegroundColor Green
    } else {
        Write-Host "   ✅ Key Vault already exists" -ForegroundColor Cyan
    }

    Write-Host "Key Vault: https://$KeyVaultName.vault.azure.net/ (Private)" -ForegroundColor Cyan

    # Create Private Endpoint for Key Vault
    Write-Host "Checking Private Endpoint for Key Vault..." -ForegroundColor Green
    $kvPeExists = az network private-endpoint show `
        --name "$KeyVaultName-pe" `
        --resource-group $ResourceGroup `
        --query "id" `
        --output tsv 2>$null
    
    if (-not $kvPeExists) {
        Write-Host "Creating Private Endpoint for Key Vault..." -ForegroundColor Yellow
        az network private-endpoint create `
            --name "$KeyVaultName-pe" `
            --resource-group $ResourceGroup `
            --location $Location `
            --subnet $privateEndpointsSubnetId `
            --private-connection-resource-id "/subscriptions/$(az account show --query id -o tsv)/resourceGroups/$ResourceGroup/providers/Microsoft.KeyVault/vaults/$KeyVaultName" `
            --group-id vault `
            --connection-name "$KeyVaultName-connection" | Out-Null
        Write-Host "   ✅ Private Endpoint created" -ForegroundColor Green
    } else {
        Write-Host "   ✅ Private Endpoint already exists" -ForegroundColor Cyan
    }

    # Create Private DNS Zone for Key Vault
    Write-Host "Configuring Private DNS for Key Vault..." -ForegroundColor Green
    
    # Check if DNS zone exists
    $kvDnsZoneExists = az network private-dns zone show `
        --resource-group $ResourceGroup `
        --name "privatelink.vaultcore.azure.net" `
        --query "id" `
        --output tsv 2>$null
    
    if (-not $kvDnsZoneExists) {
        az network private-dns zone create `
            --resource-group $ResourceGroup `
            --name "privatelink.vaultcore.azure.net" | Out-Null
        Write-Host "   ✅ Private DNS Zone created" -ForegroundColor Green
    }

    # Check if VNet link exists
    $kvVnetLinkExists = az network private-dns link vnet show `
        --resource-group $ResourceGroup `
        --zone-name "privatelink.vaultcore.azure.net" `
        --name "keyvault-dns-link" `
        --query "id" `
        --output tsv 2>$null
    
    if (-not $kvVnetLinkExists) {
        az network private-dns link vnet create `
            --resource-group $ResourceGroup `
            --zone-name "privatelink.vaultcore.azure.net" `
            --name "keyvault-dns-link" `
            --virtual-network $VNetName `
            --registration-enabled false | Out-Null
        Write-Host "   ✅ VNet link created" -ForegroundColor Green
    }

    # Get the DNS zone ID
    $kvDnsZoneId = az network private-dns zone show `
        --resource-group $ResourceGroup `
        --name "privatelink.vaultcore.azure.net" `
        --query "id" `
        --output tsv

    # Create DNS zone group for automatic DNS record management
    Write-Host "Configuring DNS zone group for Key Vault..." -ForegroundColor Green
    az network private-endpoint dns-zone-group create `
        --resource-group $ResourceGroup `
        --endpoint-name "$KeyVaultName-pe" `
        --name "keyvault-dns-zone-group" `
        --private-dns-zone $kvDnsZoneId `
        --zone-name "privatelink.vaultcore.azure.net" | Out-Null
    
    Write-Host "   ✅ Key Vault Private Endpoint DNS configured" -ForegroundColor Green

    # Temporarily enable public access to store secrets (will be disabled after)
    Write-Host "Temporarily enabling public access to store secrets..." -ForegroundColor Yellow
    az keyvault update `
        --name $KeyVaultName `
        --resource-group $ResourceGroup `
        --public-network-access Enabled

    # Get current user object ID for temporary access
    $currentUserObjectId = $(az ad signed-in-user show --query id --output tsv)

    if ([string]::IsNullOrEmpty($currentUserObjectId) -and [string]::IsNullOrEmpty($ENV:CURRENT_AZURE_OBJECT_ID)) {
        Write-Host "Unable to retrieve current user Object ID" -ForegroundColor Yellow
        Write-Host "- Retrieve Object AID from Microsoft Entra, current user name '$(az account show --query "user.name" -o tsv)'" -ForegroundColor Yellow
        $currentUserObjectId = Read-Host "  Enter Object ID" 
    }
    elseif ([string]::IsNullOrEmpty($currentUserObjectId)) {
        $currentUserObjectId = $ENV:CURRENT_AZURE_OBJECT_ID
    }

    # Assign temporary Key Vault Administrator role to current user
    az role assignment create `
        --assignee $currentUserObjectId `
        --role "Key Vault Administrator" `
        --scope "/subscriptions/$(az account show --query id -o tsv)/resourceGroups/$ResourceGroup/providers/Microsoft.KeyVault/vaults/$KeyVaultName"

    Write-Host "Waiting for role assignment to propagate..." -ForegroundColor Yellow
    Start-Sleep -Seconds 30

    # Store secrets in Key Vault
    Write-Host "Storing secrets in Key Vault..." -ForegroundColor Green

    # Store Copilot Studio client secret
    if ($CopilotStudioClientSecret) {
        az keyvault secret set `
            --vault-name $KeyVaultName `
            --name "copilot-studio-client-secret" `
            --value $CopilotStudioClientSecret | Out-Null
        Write-Host "   ✅ Stored Copilot Studio client secret" -ForegroundColor Green
    }

    # Store AI Foundry client secret
    if ($AiFoundryClientSecret) {
        az keyvault secret set `
            --vault-name $KeyVaultName `
            --name "ai-foundry-client-secret" `
            --value $AiFoundryClientSecret | Out-Null
        Write-Host "   ✅ Stored AI Foundry client secret" -ForegroundColor Green
    }

    # Store Power BI client secret
    if ($PowerBIClientSecret) {
        az keyvault secret set `
            --vault-name $KeyVaultName `
            --name "powerbi-client-secret" `
            --value $PowerBIClientSecret | Out-Null
        Write-Host "   ✅ Stored Power BI client secret" -ForegroundColor Green
    }

    # Disable public access again
    Write-Host "Disabling public access to Key Vault..." -ForegroundColor Green
    az keyvault update `
        --name $KeyVaultName `
        --resource-group $ResourceGroup `
        --public-network-access Disabled
    Write-Host "   ✅ Key Vault secured with private access only" -ForegroundColor Green

    # Create AI Foundry account (required)
    Write-Host ""
    Write-Host "Checking Azure AI Foundry account..." -ForegroundColor Green
    # Use list command with query to check if AI Foundry account exists
    $aiFoundryExists = az cognitiveservices account list `
        --resource-group $ResourceGroup `
        --query "[?name=='$AiFoundryAccountName'].id | [0]" `
        --output tsv 2>$null

    if (-not $aiFoundryExists) {
        Write-Host "Creating Azure AI Foundry account..." -ForegroundColor Yellow
        az cognitiveservices account create `
            --name $AiFoundryAccountName `
            --resource-group $ResourceGroup `
            --location $Location `
            --kind AIServices `
            --sku S0 `
            --custom-domain $AiFoundryAccountName `
            --yes | Out-Null
        Write-Host "   ✅ AI Foundry account created: $AiFoundryAccountName" -ForegroundColor Green
    } else {
        Write-Host "   ✅ AI Foundry account already exists" -ForegroundColor Cyan
        
        # Check if custom domain is set using list command
        $customDomain = az cognitiveservices account list `
            --resource-group $ResourceGroup `
            --query "[?name=='$AiFoundryAccountName'].properties.customSubDomainName | [0]" `
            --output tsv 2>$null
        
        if ([string]::IsNullOrEmpty($customDomain)) {
            Write-Host "   ⚠️  AI Foundry account exists but needs custom domain for project creation" -ForegroundColor Yellow
            Write-Host "   Deleting and recreating with custom domain..." -ForegroundColor Yellow
            az cognitiveservices account delete `
                --name $AiFoundryAccountName `
                --resource-group $ResourceGroup `
                --yes | Out-Null
            
            Write-Host "   Creating AI Foundry account with custom domain..." -ForegroundColor Yellow
            az cognitiveservices account create `
                --name $AiFoundryAccountName `
                --resource-group $ResourceGroup `
                --location $Location `
                --kind AIServices `
                --sku S0 `
                --custom-domain $AiFoundryAccountName `
                --yes | Out-Null
            Write-Host "   ✅ AI Foundry account recreated with custom domain" -ForegroundColor Green
        }
    }
    
    # Get the AI Foundry endpoint
    $aiFoundryEndpoint = az cognitiveservices account project show `
        --name $AiFoundryAccountName `
        --resource-group $ResourceGroup `
        --project-name $AiFoundryProjectName `
        --query 'properties.endpoints' `
        --output tsv

    Write-Host "AI Foundry Endpoint: $aiFoundryEndpoint" -ForegroundColor Cyan
    
    # Create AI Foundry Project
    Write-Host "Checking AI Foundry project..." -ForegroundColor Green
    # Suppress error output when project doesn't exist
    $aiFoundryProjectExists = (az cognitiveservices account project list `
        --name $AiFoundryAccountName `
        --resource-group $ResourceGroup) | Where-Object { $_.projectName -eq $AiFoundryProjectName } | Select-Object -First 1

    if (-not $aiFoundryProjectExists -or $LASTEXITCODE -ne 0) {
        Write-Host "Creating AI Foundry project..." -ForegroundColor Yellow
        az cognitiveservices account project create `
            --name $AiFoundryAccountName `
            --project-name $AiFoundryProjectName `
            --resource-group $ResourceGroup `
            --location $Location `
            --display-name $AiFoundryProjectName `
            --description "AI Foundry project for Call Center AI Insights" `
            --assign-identity | Out-Null
        Write-Host "   ✅ AI Foundry project created: $AiFoundryProjectName" -ForegroundColor Green
    } else {
        Write-Host "   ✅ AI Foundry project already exists" -ForegroundColor Cyan
    }
    
    # Get the project details
    $aiFoundryProjectDetails = az cognitiveservices account project show `
        --name $AiFoundryAccountName `
        --project-name $AiFoundryProjectName `
        --resource-group $ResourceGroup `
        --output json | ConvertFrom-Json

    $aiFoundryProjectId = $aiFoundryProjectDetails.id
    Write-Host "AI Foundry Project ID: $aiFoundryProjectId" -ForegroundColor Cyan
    
    # Note about agent creation
    Write-Host ""
    Write-Host "📝 AI Foundry Setup Complete:" -ForegroundColor Yellow
    Write-Host "   Account: $AiFoundryAccountName" -ForegroundColor White
    Write-Host "   Endpoint: $aiFoundryEndpoint" -ForegroundColor White
    Write-Host "   Project: $AiFoundryProjectName" -ForegroundColor White
    Write-Host "   Project ID: $aiFoundryProjectId" -ForegroundColor White
    Write-Host ""
    Write-Host "   ℹ️  Agent Creation:" -ForegroundColor Cyan
    Write-Host "   Agents are created using the Azure AI SDK or REST API, not Azure CLI." -ForegroundColor White
    Write-Host "   You can create the '$AiFoundryAgentName' agent using:" -ForegroundColor White
    Write-Host "   - Azure AI Studio (https://ai.azure.com)" -ForegroundColor White
    Write-Host "   - Azure AI SDK for Python/JavaScript" -ForegroundColor White
    Write-Host "   - Azure AI REST API" -ForegroundColor White
    Write-Host ""

    # Create Cosmos DB account (if specified)
    $cosmosDbUri = ""
    if ($CosmosDbAccountName) {
        Write-Host ""
        Write-Host "Checking Cosmos DB account: $CosmosDbAccountName" -ForegroundColor Green
        # Use list command to check if Cosmos DB exists
        $cosmosDbExists = az cosmosdb list `
            --resource-group $ResourceGroup `
            --query "[?name=='$CosmosDbAccountName'].id | [0]" `
            --output tsv 2>$null
        
        if (-not $cosmosDbExists) {
            Write-Host "Creating Cosmos DB account..." -ForegroundColor Yellow
            az cosmosdb create `
                --name $CosmosDbAccountName `
                --resource-group $ResourceGroup `
                --default-consistency-level "Session" `
                --enable-automatic-failover false | Out-Null
            Write-Host "   ✅ Cosmos DB created" -ForegroundColor Green
            
            # Disable public network access for security
            Write-Host "Disabling public network access for Cosmos DB..." -ForegroundColor Yellow
            az cosmosdb update `
                --name $CosmosDbAccountName `
                --resource-group $ResourceGroup `
                --public-network-access Disabled | Out-Null
            Write-Host "   ✅ Cosmos DB secured with private access only" -ForegroundColor Green
        } else {
            Write-Host "   ✅ Cosmos DB already exists" -ForegroundColor Cyan
        }
    
        Write-Host "Cosmos DB: $CosmosDbAccountName" -ForegroundColor Cyan
    
        # Create Private Endpoint for Cosmos DB
        Write-Host "Checking Private Endpoint for Cosmos DB..." -ForegroundColor Green
        $cosmosDbPeExists = az network private-endpoint show `
            --name "$CosmosDbAccountName-pe" `
            --resource-group $ResourceGroup `
            --query "id" `
            --output tsv 2>$null
        
        if (-not $cosmosDbPeExists) {
            Write-Host "Creating Private Endpoint for Cosmos DB..." -ForegroundColor Yellow
            az network private-endpoint create `
                --name "$CosmosDbAccountName-pe" `
                --resource-group $ResourceGroup `
                --location $Location `
                --subnet $privateEndpointsSubnetId `
                --private-connection-resource-id "/subscriptions/$(az account show --query id -o tsv)/resourceGroups/$ResourceGroup/providers/Microsoft.DocumentDB/databaseAccounts/$CosmosDbAccountName" `
                --group-id Sql `
                --connection-name "$CosmosDbAccountName-connection" | Out-Null
            Write-Host "   ✅ Private Endpoint created" -ForegroundColor Green
        } else {
            Write-Host "   ✅ Private Endpoint already exists" -ForegroundColor Cyan
        }
    
        # Create Private DNS Zone for Cosmos DB
        Write-Host "Configuring Private DNS for Cosmos DB..." -ForegroundColor Green
        
        # Check if DNS zone exists
        $cosmosDnsZoneExists = az network private-dns zone show `
            --resource-group $ResourceGroup `
            --name "privatelink.documents.azure.com" `
            --query "id" `
            --output tsv 2>$null
        
        if (-not $cosmosDnsZoneExists) {
            az network private-dns zone create `
                --resource-group $ResourceGroup `
                --name "privatelink.documents.azure.com" | Out-Null
            Write-Host "   ✅ Private DNS Zone created" -ForegroundColor Green
        }
    
        # Check if VNet link exists
        $cosmosVnetLinkExists = az network private-dns link vnet show `
            --resource-group $ResourceGroup `
            --zone-name "privatelink.documents.azure.com" `
            --name "cosmosdb-dns-link" `
            --query "id" `
            --output tsv 2>$null
        
        if (-not $cosmosVnetLinkExists) {
            az network private-dns link vnet create `
                --resource-group $ResourceGroup `
                --zone-name "privatelink.documents.azure.com" `
                --name "cosmosdb-dns-link" `
                --virtual-network $VNetName `
                --registration-enabled false | Out-Null
            Write-Host "   ✅ VNet link created" -ForegroundColor Green
        }
    
        # Get the DNS zone ID
        $cosmosDnsZoneId = az network private-dns zone show `
            --resource-group $ResourceGroup `
            --name "privatelink.documents.azure.com" `
            --query "id" `
            --output tsv
    
        # Create DNS zone group for automatic DNS record management
        Write-Host "Configuring DNS zone group for Cosmos DB..." -ForegroundColor Green
        az network private-endpoint dns-zone-group create `
            --resource-group $ResourceGroup `
            --endpoint-name "$CosmosDbAccountName-pe" `
            --name "cosmosdb-dns-zone-group" `
            --private-dns-zone $cosmosDnsZoneId `
            --zone-name "privatelink.documents.azure.com" | Out-Null
        
        Write-Host "   ✅ Cosmos DB Private Endpoint DNS configured" -ForegroundColor Green
    
        # Create database and containers
        Write-Host "Checking Cosmos DB database and containers..." -ForegroundColor Green
        $cosmosDbDatabaseExists = az cosmosdb sql database show `
            --account-name $CosmosDbAccountName `
            --resource-group $ResourceGroup `
            --name $CosmosDbDatabaseName `
            --query "id" `
            --output tsv 2>$null
        
        if (-not $cosmosDbDatabaseExists) {
            Write-Host "Creating Cosmos DB database..." -ForegroundColor Yellow
            az cosmosdb sql database create `
                --account-name $CosmosDbAccountName `
                --resource-group $ResourceGroup `
                --name $CosmosDbDatabaseName | Out-Null
            Write-Host "   ✅ Database created" -ForegroundColor Green
        } else {
            Write-Host "   ✅ Database already exists" -ForegroundColor Cyan
        }
    
        # Create Sessions container (partitioned by userId)
        $sessionsContainerExists = az cosmosdb sql container show `
            --account-name $CosmosDbAccountName `
            --resource-group $ResourceGroup `
            --database-name $CosmosDbDatabaseName `
            --name $CosmosDbSessionsContainer `
            --query "id" `
            --output tsv 2>$null
        
        if (-not $sessionsContainerExists) {
            Write-Host "Creating Sessions container..." -ForegroundColor Yellow
            az cosmosdb sql container create `
                --account-name $CosmosDbAccountName `
                --resource-group $ResourceGroup `
                --database-name $CosmosDbDatabaseName `
                --name $CosmosDbSessionsContainer `
                --partition-key-path "/userId" `
                --throughput 400 | Out-Null
            Write-Host "   ✅ Sessions container created" -ForegroundColor Green
        } else {
            Write-Host "   ✅ Sessions container already exists" -ForegroundColor Cyan
        }
    
        # Create Messages container (partitioned by sessionId)
        $messagesContainerExists = az cosmosdb sql container show `
            --account-name $CosmosDbAccountName `
            --resource-group $ResourceGroup `
            --database-name $CosmosDbDatabaseName `
            --name $CosmosDbMessagesContainer `
            --query "id" `
            --output tsv 2>$null
        
        if (-not $messagesContainerExists) {
            Write-Host "Creating Messages container..." -ForegroundColor Yellow
            az cosmosdb sql container create `
                --account-name $CosmosDbAccountName `
                --resource-group $ResourceGroup `
                --database-name $CosmosDbDatabaseName `
                --name $CosmosDbMessagesContainer `
                --partition-key-path "/sessionId" `
                --throughput 400 | Out-Null
            Write-Host "   ✅ Messages container created" -ForegroundColor Green
        } else {
            Write-Host "   ✅ Messages container already exists" -ForegroundColor Cyan
        }
    
        # Get Cosmos DB URI
        $cosmosDbUri = "https://$CosmosDbAccountName.documents.azure.com:443/"
        Write-Host "Cosmos DB URI: $cosmosDbUri" -ForegroundColor Cyan
    }

    # Create Log Analytics workspace for monitoring
    Write-Host ""
    Write-Host "Checking Log Analytics workspace..." -ForegroundColor Green
    $logAnalyticsWorkspaceName = "$ResourceGroup-logs"
    
    # Use list command to check if Log Analytics workspace exists
    $logAnalyticsExists = az monitor log-analytics workspace list `
        --resource-group $ResourceGroup `
        --query "[?name=='$logAnalyticsWorkspaceName'].id | [0]" `
        --output tsv 2>$null
    
    if (-not $logAnalyticsExists) {
        Write-Host "Creating Log Analytics workspace..." -ForegroundColor Yellow
        az monitor log-analytics workspace create `
            --workspace-name $logAnalyticsWorkspaceName `
            --resource-group $ResourceGroup `
            --location $Location | Out-Null
        Write-Host "   ✅ Log Analytics workspace created" -ForegroundColor Green
    } else {
        Write-Host "   ✅ Log Analytics workspace already exists" -ForegroundColor Cyan
    }

    # Get the workspace ID and key (needed whether existing or new)
    $logAnalyticsId = az monitor log-analytics workspace show `
        --workspace-name $logAnalyticsWorkspaceName `
        --resource-group $ResourceGroup `
        --query "customerId" `
        --output tsv

    $logAnalyticsKey = az monitor log-analytics workspace get-shared-keys `
        --workspace-name $logAnalyticsWorkspaceName `
        --resource-group $ResourceGroup `
        --query "primarySharedKey" `
        --output tsv

    Write-Host "Log Analytics Workspace: $logAnalyticsWorkspaceName" -ForegroundColor Cyan

    # Create Container Apps environment with VNet integration and monitoring
    Write-Host ""
    Write-Host "Checking Container Apps environment..." -ForegroundColor Green
    # Use list command to check if Container Apps environment exists
    $envExists = az containerapp env list `
        --resource-group $ResourceGroup `
        --query "[?name=='$EnvironmentName'].id | [0]" `
        --output tsv 2>$null
    
    if (-not $envExists) {
        Write-Host "Creating Container Apps environment..." -ForegroundColor Yellow
        az containerapp env create `
            --name $EnvironmentName `
            --resource-group $ResourceGroup `
            --location $Location `
            --infrastructure-subnet-resource-id $containerAppsSubnetId `
            --internal-only false `
            --logs-workspace-id $logAnalyticsId `
            --logs-workspace-key $logAnalyticsKey | Out-Null
        Write-Host "   ✅ Container Apps Environment created" -ForegroundColor Green
    } else {
        Write-Host "   ✅ Container Apps Environment already exists" -ForegroundColor Cyan
    }

    Write-Host "Container Apps Environment configured with VNet and monitoring" -ForegroundColor Cyan
    Write-Host "   - Internal networking enabled for backend services" -ForegroundColor White
    Write-Host "   - External ingress available for frontend" -ForegroundColor White
    Write-Host "   - User-assigned managed identity configured for ACR authentication" -ForegroundColor White

} # End of infrastructure provisioning

# Code deployment
if (-not $InfraOnly) {
    Write-Host ""
    Write-Host "=== Deploying Application Code ===" -ForegroundColor Cyan
    Write-Host ""
    
    # Generate version tag from UTC timestamp
    $imageVersion = (Get-Date).ToUniversalTime().ToString("yyyy.MM.dd.HHmm")
    Write-Host "Image Version: $imageVersion (UTC)" -ForegroundColor Cyan
    
    # If running in CodeOnly mode, retrieve infrastructure values
    if ($CodeOnly) {
        Write-Host "Retrieving infrastructure configuration..." -ForegroundColor Green
        
        # Get AI Foundry endpoint
        $aiFoundryEndpoint = az cognitiveservices account project show `
            --name $AiFoundryAccountName `
            --resource-group $ResourceGroup `
            --project-name $AiFoundryProjectName `
            --query 'properties.endpoints' `
            --output tsv

        Write-Host "AI Foundry Endpoint: $aiFoundryEndpoint" -ForegroundColor Cyan
        
        # Get Cosmos DB URI if configured
        if ($CosmosDbAccountName) {
            $cosmosDbUri = "https://$CosmosDbAccountName.documents.azure.com:443/"
            Write-Host "   Cosmos DB URI: $cosmosDbUri" -ForegroundColor Cyan
        }
    }

    # Get the managed identity details
    $managedIdentityId = az identity show `
        --name $managedIdentityName `
        --resource-group $ResourceGroup `
        --query "id" `
        --output tsv
    
    # Build and push backend image
    Write-Host ""
    Write-Host "Building and pushing backend image..." -ForegroundColor Green
    Push-Location backend
    az acr build `
        --registry $ContainerRegistry `
        --image "${BackendAppName}:${imageVersion}" `
        --image "${BackendAppName}:latest" `
        --file Dockerfile `
        .
    Pop-Location
    Write-Host "   ✅ Backend image tagged: $imageVersion and latest" -ForegroundColor Green

    # Prepare environment variables for backend
    # Note: ALLOWED_ORIGINS is configured via Container App CORS settings, not environment variables
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

    # Add Copilot Studio environment variables if configured
    if ($CopilotStudioEnvironmentId -and $CopilotStudioSchemaName) {
        $backendEnvVars += @(
            "COPILOT_STUDIO_ENVIRONMENT_ID=$CopilotStudioEnvironmentId"
            "COPILOT_STUDIO_SCHEMA_NAME=$CopilotStudioSchemaName"
            "COPILOT_STUDIO_TENANT_ID=$EntraTenantId"
            "COPILOT_STUDIO_APP_CLIENT_ID=$EntraBackendClientId"
        )
    }

    # Add AI Foundry environment variables (always configured)
    $AiFoundryAgentId = "" # Replace in the future to retrive using CLI
    if ([string]::IsNullOrEmpty($AiFoundryAgentId) -and [string]::IsNullOrEmpty($ENV:CURRENT_AZURE_AI_FOUNDRY_AGENT_ID)) {
        Write-Host "Unable to retrieve current agent ID" -ForegroundColor Yellow
        Write-Host "- Retrieve Agent ID from AI Foundry Portal, current agent name '$AiFoundryAgentName'" -ForegroundColor Yellow
        $AiFoundryAgentId = Read-Host "  Enter Agent ID"
        $ENV:CURRENT_AZURE_AI_FOUNDRY_AGENT_ID = $AiFoundryAgentId
    }
    elseif ([string]::IsNullOrEmpty($AiFoundryAccountId)) {
        $AiFoundryAgentId = $ENV:CURRENT_AZURE_AI_FOUNDRY_AGENT_ID
    }

    $backendEnvVars += @(
        "AI_FOUNDRY_ENDPOINT=$aiFoundryEndpoint"
        "AI_FOUNDRY_TENANT_ID=$EntraTenantId"
        "AI_FOUNDRY_APP_CLIENT_ID=$EntraBackendClientId"
        "AI_FOUNDRY_AGENT_ID=$AiFoundryAgentId"
    )

    # Add Power BI environment variables if configured
    if ($PowerBIClientId -and $PowerBIClientSecret -and $PowerBIWorkspaceId -and $PowerBIReportId) {
        # Use provided tenant ID or default to Entra tenant ID
        $powerBITenantId = if ($PowerBITenantId) { $PowerBITenantId } else { $EntraTenantId }
        
        $backendEnvVars += @(
            "POWERBI_TENANT_ID=$powerBITenantId"
            "POWERBI_CLIENT_ID=$PowerBIClientId"
            "POWERBI_WORKSPACE_ID=$PowerBIWorkspaceId"
            "POWERBI_REPORT_ID=$PowerBIReportId"
        )
        Write-Host "   ℹ️  Power BI configuration will be added (service principal auth)" -ForegroundColor Cyan
    }

    # Deploy or update backend container app (internal ingress only - accessible only within VNet)
    Write-Host ""
    
    # Check if backend app already exists using list command
    $backendExists = az containerapp list `
        --resource-group $ResourceGroup `
        --query "[?name=='$BackendAppName'].name | [0]" `
        --output tsv 2>$null
    
    if ($backendExists) {
        Write-Host "Updating existing backend container app..." -ForegroundColor Green
        
        # Assign user-assigned identity for ACR access and system-assigned for other services
        Write-Host "Configuring managed identities..." -ForegroundColor Yellow
        az containerapp identity assign `
            --name $BackendAppName `
            --resource-group $ResourceGroup `
            --system-assigned `
            --user-assigned $managedIdentityId | Out-Null
        
        # Update the app with the new image using user-assigned identity for registry

        az containerapp update `
            --name $BackendAppName `
            --resource-group $ResourceGroup `
            --image "$ContainerRegistry.azurecr.io/${BackendAppName}:${imageVersion}" `
            --set-env-vars $backendEnvVars
        
        Write-Host "   ✅ Backend updated with new image" -ForegroundColor Green
    } else {
        Write-Host "Deploying backend container app (internal ingress)..." -ForegroundColor Green
               
        # Create with user-assigned identity for ACR and system-assigned for other services
        az containerapp create `
            --name $BackendAppName `
            --resource-group $ResourceGroup `
            --environment $EnvironmentName `
            --image "$ContainerRegistry.azurecr.io/${BackendAppName}:${imageVersion}" `
            --target-port 8000 `
            --ingress external `
            --registry-server "$ContainerRegistry.azurecr.io" `
            --registry-identity $managedIdentityId `
            --user-assigned $managedIdentityId `
            --env-vars $backendEnvVars `
            --system-assigned `
            --cpu 0.5 `
            --memory 1Gi

        Write-Host "   ✅ Backend deployed with external ingress (publicly accessible)" -ForegroundColor Green
    }

    # Configure backend app managed identity for Cosmos DB, Key Vault, and AI Foundry access
    Write-Host "Configuring backend managed identity permissions..." -ForegroundColor Green
    
    # Ensure the backend app has system-assigned identity
    az containerapp identity assign `
        --name $BackendAppName `
        --resource-group $ResourceGroup `
        --system-assigned | Out-Null
    
    $principalId = az containerapp identity show `
        --name $BackendAppName `
        --resource-group $ResourceGroup `
        --query "principalId" `
        --output tsv

    Write-Host "Backend Managed Identity Principal ID: $principalId" -ForegroundColor Cyan

    # Assign Cosmos DB access if Cosmos DB is configured
    if ($CosmosDbAccountName) {
        Write-Host "Assigning Cosmos DB access to managed identity..." -ForegroundColor Green

        $resourceGroupId = $(az group show --name $ResourceGroup --query id -o tsv)
        $cosmosDbResourceId = "$resourceGroupId/providers/Microsoft.DocumentDB/databaseAccounts/$CosmosDbAccountName"

        # Getting Azure Cosmos DB Control Plane Owner Role definition existance

        $cosmosControlPlaneRoleId = az role definition list --query "[?roleName=='Azure Cosmos DB Control Plane Owner'].id" -o tsv

        if ($cosmosControlPlaneRoleId) {
            Write-Host "   ✅ Azure Cosmos DB Control Plane Owner role definition exists" -ForegroundColor Cyan

            $(az role definition show --id $cosmosControlPlaneRoleId) | Out-File -FilePath ".\temp-role-definition.json"

            # Check if current Resource Group exists on the Assignable scope
            $cosmosControlPlaneRole = Get-Content -Raw ".\temp-role-definition.json" | ConvertFrom-Json

            if ($cosmosControlPlaneRole.assignableScopes -contains $resourceGroupId) {
                Write-Host "   ✅ Current Resource Group is in the Assignable scope" -ForegroundColor Cyan
                
                Remove-Item .\temp-role-definition.json -Force
            }
            else {
                Write-Host "   - Adding current Resource Group to Assignable scopes" -ForegroundColor Yellow
                
                $cosmosControlPlaneRole.assignableScopes+=$resourceGroupId
                
                ($cosmosControlPlaneRole | ConvertTo-Json -Depth 5) | Out-File -FilePath ".\temp-role-definition.json" -Force
                
                az role definition update --role-definition .\temp-role-definition.json

                Remove-Item .\temp-role-definition.json -Force
            }

        } else {
            Write-Host "   - Creating Azure Cosmos DB Control Plane Owner role definition" -ForegroundColor Yellow
            
'{
  "Name": "Azure Cosmos DB Control Plane Owner",
  "IsCustom": true,
  "Description": "Can perform all control plane actions for an Azure Cosmos DB account.",
  "Actions": [
    "Microsoft.DocumentDb/*"
  ],
  "AssignableScopes": [
    "[__RESOURCE_GROUP_ID__]"
  ]
}'.Replace('[__RESOURCE_GROUP_ID__]', "$(az group show --name $ResourceGroup --query id -o tsv)") | Out-File -FilePath ".\temp-role-definition.json"

            az role definition create --role-definition .\temp-role-definition.json

            Remove-Item .\temp-role-definition.json -Force
        }

        $cosmosControlPlaneRoleId = az role definition list --query "[?roleName=='Azure Cosmos DB Control Plane Owner'].id" -o tsv


        az role assignment create `
        --assignee $principalId `
        --role $cosmosControlPlaneRoleId `
        --scope $resourceGroupId | Out-Null

        # Getting the role definition ID
        $cosmosDbDataCustomRoleId = az cosmosdb sql role definition list --resource-group $ResourceGroup --account-name $CosmosDbAccountName --query "[?roleName=='Azure Cosmos DB for NoSQL Data Plane Owner'].id" --output tsv

        # Creating role definition if doesn't exists
        if (-not $cosmosDbDataCustomRoleId) {
            Write-Host "   Creating custom role definition for Cosmos DB data plane access..." -ForegroundColor Yellow

'{
  "RoleName": "Azure Cosmos DB for NoSQL Data Plane Owner",
  "Type": "CustomRole",
  "AssignableScopes": [
    "/"
  ],
  "Permissions": [
    {
      "DataActions": [
        "Microsoft.DocumentDB/databaseAccounts/readMetadata",
        "Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers/*",
        "Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers/items/*"
      ]
    }
  ]
}' | Out-File -FilePath ".\temp-cosmosdb-role-definition.json"
            az cosmosdb sql role definition create `
            --resource-group $ResourceGroup `
            --account-name $CosmosDbAccountName `
            --body @temp-cosmosdb-role-definition.json

            Remove-Item .\temp-cosmosdb-role-definition.json -Force
        }
        else {
            Write-Host "   ✅ Custom role definition for Cosmos DB data plane access already exists" -ForegroundColor Cyan
        }

        $checkCosmosDbRoleAssignment = az cosmosdb sql role assignment list --resource-group $ResourceGroup --account-name $CosmosDbAccountName --query "[?principalId=='$principalId']" --output tsv

        if (-not $checkCosmosDbRoleAssignment) {
            Write-Host "   Creating role assignment for Cosmos DB data plane access..." -ForegroundColor Yellow

            $cosmosDbDataCustomRoleId = az cosmosdb sql role definition list --resource-group $ResourceGroup --account-name $CosmosDbAccountName --query "[?roleName=='Azure Cosmos DB for NoSQL Data Plane Owner'].name" --output tsv

            az cosmosdb sql role assignment create `
                --resource-group $ResourceGroup `
                --account-name $CosmosDbAccountName `
                --role-definition-id $cosmosDbDataCustomRoleId `
                --scope $cosmosDbResourceId `
                --principal-id $principalId 
        }
        else {
            Write-Host "   ✅ Custom role assignment for Cosmos DB data plane access already exists" -ForegroundColor Cyan
        }
    }

    # Assign AI Foundry access (required)
    Write-Host "Assigning AI Foundry access to managed identity..." -ForegroundColor Green
    $aiFoundryResourceId = "/subscriptions/$(az account show --query id -o tsv)/resourceGroups/$ResourceGroup/providers/Microsoft.CognitiveServices/accounts/$AiFoundryAccountName"
    
    # Assign Cognitive Services User role for the AI Foundry account
    az role assignment create `
        --assignee $principalId `
        --role "Cognitive Services User" `
        --scope $aiFoundryResourceId
    
    Write-Host "   ✅ AI Foundry access configured" -ForegroundColor Green
    Write-Host "   ℹ️  Backend app can now authenticate to AI Foundry using managed identity" -ForegroundColor Cyan

    # Assign Key Vault Secrets User role to the managed identity
    Write-Host "Assigning Key Vault access to managed identity..." -ForegroundColor Green
    $keyVaultResourceId = "/subscriptions/$(az account show --query id -o tsv)/resourceGroups/$ResourceGroup/providers/Microsoft.KeyVault/vaults/$KeyVaultName"
    az role assignment create `
        --assignee $principalId `
        --role "Key Vault Secrets User" `
        --scope $keyVaultResourceId
    Write-Host "   ✅ Key Vault access configured" -ForegroundColor Green

    # Update backend with Key Vault references for secrets
    if ($CopilotStudioClientSecret) {
        Write-Host "Configuring Copilot Studio secret from Key Vault..." -ForegroundColor Green
        az containerapp secret set `
            --name $BackendAppName `
            --resource-group $ResourceGroup `
            --secrets "copilot-studio-secret=keyvaultref:https://$KeyVaultName.vault.azure.net/secrets/copilot-studio-client-secret,identityref:system"
    
        az containerapp update `
            --name $BackendAppName `
            --resource-group $ResourceGroup `
            --set-env-vars "COPILOT_STUDIO_APP_CLIENT_SECRET=secretref:copilot-studio-secret"
        Write-Host "   ✅ Copilot Studio secret configured" -ForegroundColor Green
    }

    if ($AiFoundryClientSecret) {
        Write-Host "Configuring AI Foundry secret from Key Vault..." -ForegroundColor Green
        az containerapp secret set `
            --name $BackendAppName `
            --resource-group $ResourceGroup `
            --secrets "ai-foundry-secret=keyvaultref:https://$KeyVaultName.vault.azure.net/secrets/ai-foundry-client-secret,identityref:system"
    
        az containerapp update `
            --name $BackendAppName `
            --resource-group $ResourceGroup `
            --set-env-vars "AI_FOUNDRY_APP_CLIENT_SECRET=secretref:ai-foundry-secret"
        Write-Host "   ✅ AI Foundry secret configured" -ForegroundColor Green
    }

    if ($PowerBIClientSecret) {
        Write-Host "Configuring Power BI secret from Key Vault..." -ForegroundColor Green
        az containerapp secret set `
            --name $BackendAppName `
            --resource-group $ResourceGroup `
            --secrets "powerbi-secret=keyvaultref:https://$KeyVaultName.vault.azure.net/secrets/powerbi-client-secret,identityref:system"
    
        az containerapp update `
            --name $BackendAppName `
            --resource-group $ResourceGroup `
            --set-env-vars "POWERBI_CLIENT_SECRET=secretref:powerbi-secret"
        Write-Host "   ✅ Power BI secret configured" -ForegroundColor Green
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

    $defaultEnvDomain = az containerapp env show `
        --resource-group $ResourceGroup `
        --name $EnvironmentName `
        --query "properties.defaultDomain" `
        --output tsv
        
    $backendUrl = "https://$BackendAppName.$defaultEnvDomain"

    $frontendUrl = "https://$FrontendAppName.$defaultEnvDomain"

    az acr build `
        --registry $ContainerRegistry `
        --image "${FrontendAppName}:${imageVersion}" `
        --image "${FrontendAppName}:latest" `
        --file Dockerfile `
        --build-arg "VITE_ENTRA_CLIENT_ID=$EntraFrontendClientId" `
        --build-arg "VITE_ENTRA_TENANT_ID=$EntraTenantId" `
        --build-arg "VITE_API_SCOPE=api://$EntraBackendClientId/access_as_user" `
        --build-arg "VITE_API_BASE_URL='$backendUrl'" `
        --build-arg "VITE_REDIRECT_URI='$frontendUrl'" `
        --build-arg "VITE_POST_LOGOUT_REDIRECT_URI='$frontendUrl'" `
        --build-arg "VITE_TENANT_ID='$VITE_TENANT_ID'" `
        --build-arg "VITE_TENANT_NAME='$VITE_TENANT_NAME'" `
        --build-arg "VITE_TENANT_LOGO_URL='$VITE_TENANT_LOGO_URL'" `
        --build-arg "VITE_TENANT_FAVICON_URL='$VITE_TENANT_FAVICON_URL'" `
        --build-arg "VITE_TENANT_PRIMARY_COLOR='$VITE_TENANT_PRIMARY_COLOR'" `
        --build-arg "VITE_TENANT_SECONDARY_COLOR='$VITE_TENANT_SECONDARY_COLOR'" `
        .
        
    Pop-Location
    Write-Host "   ✅ Frontend image tagged: $imageVersion and latest" -ForegroundColor Green

    # Deploy or update frontend container app (external ingress - publicly accessible)
    Write-Host ""
    
    # Check if frontend app already exists using list command
    $frontendExists = az containerapp list `
        --resource-group $ResourceGroup `
        --query "[?name=='$FrontendAppName'].name | [0]" `
        --output tsv 2>$null
    
    if ($frontendExists) {
        Write-Host "Updating existing frontend container app..." -ForegroundColor Green
        
        # Assign user-assigned identity for ACR access
        Write-Host "Configuring user-assigned managed identity..." -ForegroundColor Yellow
        az containerapp identity assign `
            --name $FrontendAppName `
            --resource-group $ResourceGroup `
            --user-assigned $managedIdentityId | Out-Null
        
        # Update the app with the new image using user-assigned identity for registry
        az containerapp update `
            --name $FrontendAppName `
            --resource-group $ResourceGroup `
            --image "$ContainerRegistry.azurecr.io/${FrontendAppName}:${imageVersion}"
        
        Write-Host "   ✅ Frontend updated with new image" -ForegroundColor Green
    } else {
        Write-Host "Deploying frontend container app (external ingress)..." -ForegroundColor Green
        
        # Create with user-assigned identity for ACR access
        az containerapp create `
            --name $FrontendAppName `
            --resource-group $ResourceGroup `
            --environment $EnvironmentName `
            --image "$ContainerRegistry.azurecr.io/${FrontendAppName}:${imageVersion}" `
            --target-port 80 `
            --ingress external `
            --registry-server "$ContainerRegistry.azurecr.io" `
            --registry-identity $managedIdentityId `
            --user-assigned $managedIdentityId `
            --cpu 0.5 `
            --memory 1Gi

        Write-Host "   ✅ Frontend deployed with external ingress (publicly accessible)" -ForegroundColor Green
    }
    
    # Get frontend URL
    $frontendUrl = az containerapp show `
        --name $FrontendAppName `
        --resource-group $ResourceGroup `
        --query "properties.configuration.ingress.fqdn" `
        --output tsv

    $frontendUrl = "https://$frontendUrl"
    Write-Host "Frontend URL: $frontendUrl" -ForegroundColor Cyan

    # Configure backend CORS using Azure Container Apps native CORS support
    Write-Host ""
    Write-Host "Configuring backend CORS policy..." -ForegroundColor Green
    az containerapp ingress cors enable `
        --name $BackendAppName `
        --resource-group $ResourceGroup `
        --allowed-origins $frontendUrl `
        --allowed-methods GET POST PUT DELETE OPTIONS `
        --allowed-headers "*" `
        --expose-headers "*" `
        --max-age 3600
    
    Write-Host "   ✅ CORS configured to allow: $frontendUrl" -ForegroundColor Green

} # End of code deployment

# For CodeOnly mode, retrieve URLs if not already set (in case apps were already deployed)
if ($CodeOnly -and -not $backendUrl) {
    Write-Host "Retrieving existing app URLs..." -ForegroundColor Green
    
    $backendUrl = az containerapp show `
        --name $BackendAppName `
        --resource-group $ResourceGroup `
        --query "properties.configuration.ingress.fqdn" `
        --output tsv 2>$null
    
    if ($backendUrl) {
        $backendUrl = "https://$backendUrl"
    }
    
    $frontendUrl = az containerapp show `
        --name $FrontendAppName `
        --resource-group $ResourceGroup `
        --query "properties.configuration.ingress.fqdn" `
        --output tsv 2>$null
    
    if ($frontendUrl) {
        $frontendUrl = "https://$frontendUrl"
    }
}

# For InfraOnly mode, also retrieve Cosmos DB URI if needed
if ($InfraOnly -and $CosmosDbAccountName -and -not $cosmosDbUri) {
    $cosmosDbUri = "https://$CosmosDbAccountName.documents.azure.com:443/"
}

# Summary
Write-Host ""
if ($InfraOnly) {
    Write-Host "=== Infrastructure Deployment Complete ===" -ForegroundColor Green
}
elseif ($CodeOnly) {
    Write-Host "=== Code Deployment Complete ===" -ForegroundColor Green
}
else {
    Write-Host "=== Deployment Complete ===" -ForegroundColor Green
}
Write-Host ""
Write-Host "📝 Deployed Resources:" -ForegroundColor Yellow

if (-not $CodeOnly) {
    Write-Host "   - Virtual Network: $VNetName ($VNetAddressPrefix)" -ForegroundColor Cyan
    Write-Host "   - Container Registry: $ContainerRegistry.azurecr.io 🔒 Private" -ForegroundColor Cyan
    Write-Host "   - Key Vault: https://$KeyVaultName.vault.azure.net/ 🔒 Private" -ForegroundColor Cyan
    Write-Host "   - Log Analytics Workspace: $logAnalyticsWorkspaceName" -ForegroundColor Cyan
    Write-Host "   - Container Apps Environment: $EnvironmentName (VNet-integrated, monitored)" -ForegroundColor Cyan
}

if (-not $InfraOnly) {
    Write-Host "   - Frontend App: $frontendUrl 🌐 Public" -ForegroundColor Cyan
    Write-Host "   - Backend API: $backendUrl 🔒 Internal (VNet only)" -ForegroundColor Cyan
}

if (-not $CodeOnly) {
    if ($CosmosDbAccountName) {
        Write-Host ""
        Write-Host "   - Cosmos DB: $cosmosDbUri 🔒 Private" -ForegroundColor Cyan
        Write-Host "     • Database: $CosmosDbDatabaseName" -ForegroundColor White
        Write-Host "     • Sessions Container: $CosmosDbSessionsContainer (partitioned by userId)" -ForegroundColor White
        Write-Host "     • Messages Container: $CosmosDbMessagesContainer (partitioned by sessionId)" -ForegroundColor White
        Write-Host "     • Private Endpoint: Enabled" -ForegroundColor White
        if (-not $InfraOnly) {
            Write-Host "     ✅ Managed Identity configured for Cosmos DB access" -ForegroundColor Green
        }
    }
    else {
        Write-Host "   ⚠️ Cosmos DB not configured - chat history will be disabled" -ForegroundColor Yellow
    }
}

if (-not $CodeOnly) {
    if ($CopilotStudioEnvironmentId -and $CopilotStudioSchemaName) {
        Write-Host ""
        Write-Host "   - Copilot Studio Agent: $CopilotStudioSchemaName" -ForegroundColor Cyan
        Write-Host "     • Environment: $CopilotStudioEnvironmentId" -ForegroundColor White
        Write-Host "     ✅ Client secret stored in Key Vault" -ForegroundColor Green
    }
    else {
        Write-Host "   ⚠️ Copilot Studio not configured" -ForegroundColor Yellow
    }
    
    Write-Host ""
    Write-Host "   - AI Foundry Account: $AiFoundryAccountName" -ForegroundColor Cyan
    Write-Host "     • Endpoint: $aiFoundryEndpoint" -ForegroundColor White
    Write-Host "     • Project: $AiFoundryProjectName" -ForegroundColor White
    Write-Host "     • Project ID: $aiFoundryProjectId" -ForegroundColor White
    if (-not $InfraOnly) {
        Write-Host "     ✅ Managed Identity configured for AI Foundry access" -ForegroundColor Green
    }
    if ($AiFoundryClientSecret) {
        Write-Host "     ✅ Client secret stored in Key Vault (for OBO flow)" -ForegroundColor Green
    }
    Write-Host ""
    Write-Host "   ℹ️  Next Steps for Agent:" -ForegroundColor Yellow
    Write-Host "     1. Go to Azure AI Studio: https://ai.azure.com" -ForegroundColor White
    Write-Host "     2. Select your project: $AiFoundryProjectName" -ForegroundColor White
    Write-Host "     3. Create agent: $AiFoundryAgentName" -ForegroundColor White
    Write-Host "     4. Configure agent with your instructions and knowledge" -ForegroundColor White
}

if (-not $CodeOnly) {
    Write-Host ""
    Write-Host "🔒 Security Configuration:" -ForegroundColor Yellow
    Write-Host "   ✅ Virtual Network isolation with dedicated subnets" -ForegroundColor Green
    Write-Host "   ✅ Private Endpoints for all backend services:" -ForegroundColor Green
    Write-Host "      • Container Registry (ACR) - Private only" -ForegroundColor White
    Write-Host "      • Key Vault - Private only" -ForegroundColor White
    if ($CosmosDbAccountName) {
        Write-Host "      • Cosmos DB - Private only" -ForegroundColor White
    }
    if (-not $InfraOnly) {
        Write-Host "   ✅ Backend API - Internal ingress only (VNet)" -ForegroundColor Green
        Write-Host "   ✅ Frontend - Public ingress (user-facing)" -ForegroundColor Green
        Write-Host "   ✅ Managed Identity enabled for backend app" -ForegroundColor Green
    }
    Write-Host "   ✅ RBAC-based authorization for all resources" -ForegroundColor Green
    Write-Host "   ✅ Secrets stored securely in Key Vault" -ForegroundColor Green
    Write-Host "   ✅ Private DNS zones for name resolution" -ForegroundColor Green
    Write-Host "   ✅ Log Analytics workspace enabled for monitoring" -ForegroundColor Green
    Write-Host ""
    Write-Host "🌐 Network Architecture:" -ForegroundColor Yellow
    Write-Host "   VNet: $VNetAddressPrefix" -ForegroundColor Cyan
    Write-Host "   ├─ Container Apps Subnet: $ContainerAppsSubnetPrefix" -ForegroundColor White
    Write-Host "   └─ Private Endpoints Subnet: $PrivateEndpointsSubnetPrefix" -ForegroundColor White
    Write-Host ""
    Write-Host "   Traffic Flow:" -ForegroundColor White
    Write-Host "   Internet → Frontend (Public) → Backend (Internal/VNet) → Private Endpoints" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "📝 Next Steps:" -ForegroundColor Yellow

if ($InfraOnly) {
    Write-Host "Infrastructure is ready. To deploy code, run:" -ForegroundColor White
    Write-Host "   .\deploy-azure.ps1 -CodeOnly" -ForegroundColor Cyan
    Write-Host ""
}
elseif ($CodeOnly) {
    Write-Host "Code deployed successfully. Applications are running." -ForegroundColor White
    Write-Host ""
}
else {
    Write-Host "1. Update your Entra ID app registrations:" -ForegroundColor White
    Write-Host "   - Frontend app redirect URIs: $frontendUrl" -ForegroundColor White
    Write-Host "   - Frontend app logout URL: $frontendUrl" -ForegroundColor White
    Write-Host "   - Backend app API permissions: Add required scopes" -ForegroundColor White
    Write-Host ""
}

if (-not $InfraOnly) {
    Write-Host "2. Test your deployment:" -ForegroundColor White
    Write-Host "   - Frontend: $frontendUrl" -ForegroundColor Cyan
    Write-Host "   - Backend Health: $backendUrl/health" -ForegroundColor Cyan
    if ($CosmosDbAccountName) {
        Write-Host "   - Chat History: Test chat functionality in the app" -ForegroundColor Cyan
    }
    if ($CopilotStudioEnvironmentId -and $CopilotStudioSchemaName) {
        Write-Host "   - Copilot Studio: Test chatbot integration" -ForegroundColor Cyan
    }
    Write-Host "   - AI Foundry: Test AI services integration" -ForegroundColor Cyan
    Write-Host "     • Endpoint: $aiFoundryEndpoint" -ForegroundColor White
}

Write-Host ""
Write-Host "📚 Documentation:" -ForegroundColor Yellow
Write-Host "   - Setup Guide: SETUP-SSO.md" -ForegroundColor White
Write-Host "   - Chat History: CHAT-HISTORY.md" -ForegroundColor White
Write-Host "   - Architecture: ARCHITECTURE.md" -ForegroundColor White
Write-Host ""

if (-not $CodeOnly -and $CosmosDbAccountName) {
    Write-Host "💡 Cosmos DB Features Available:" -ForegroundColor Green
    Write-Host "   ✅ Persistent chat history" -ForegroundColor White
    Write-Host "   ✅ User-scoped conversations" -ForegroundColor White
    Write-Host "   ✅ Error resilience and retry logic" -ForegroundColor White
    Write-Host "   ✅ Two-container optimized architecture" -ForegroundColor White
    if (-not $InfraOnly) {
        Write-Host "   ✅ Managed identity authentication" -ForegroundColor White
    }
}
