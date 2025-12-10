# Deployment Configuration

This file explains how to configure sensitive deployment parameters securely.

## Setup

1. **Copy the example configuration file:**
   ```powershell
   Copy-Item deploy-config.example.ps1 deploy-config.ps1
   ```

2. **Edit `deploy-config.ps1` with your values:**
   - Open `deploy-config.ps1` in your editor
   - Replace all `YOUR_*_HERE` placeholders with your actual values
   - Save the file

3. **Run the deployment:**
   ```powershell
   .\deploy-azure.ps1
   ```

## Security

- ✅ `deploy-config.ps1` is automatically ignored by git (see `.gitignore`)
- ✅ Your sensitive values will never be committed to the repository
- ✅ The example file (`deploy-config.example.ps1`) only contains placeholders

## Required Parameters

The following parameters **must** be configured in `deploy-config.ps1`:

- `$EntraFrontendClientId` - Microsoft Entra ID Frontend App Client ID
- `$EntraBackendClientId` - Microsoft Entra ID Backend App Client ID  
- `$EntraTenantId` - Microsoft Entra ID Tenant ID

## Optional Parameters

These are optional and only needed if you're using the respective services:

- `$CopilotStudioClientSecret` - Secret for Copilot Studio integration
- `$CopilotStudioEnvironmentId` - Copilot Studio Environment ID
- `$CopilotStudioSchemaName` - Copilot Studio Schema Name
- `$AiFoundryClientSecret` - Secret for AI Foundry (if using OBO flow)

## Alternative: Command Line Parameters

You can also pass parameters directly via command line (useful for CI/CD):

```powershell
.\deploy-azure.ps1 `
    -EntraFrontendClientId "your-id" `
    -EntraBackendClientId "your-id" `
    -EntraTenantId "your-tenant-id" `
    -CopilotStudioClientSecret "your-secret"
```

## Troubleshooting

**Error: Missing required parameters**
- Make sure you've created `deploy-config.ps1` from the example file
- Verify all required parameters have actual values (not placeholders)
- Check that the file is in the same directory as `deploy-azure.ps1`

**Configuration not loading**
- Verify the file is named exactly `deploy-config.ps1` (not `.example.ps1`)
- Check file permissions - it should be readable
- Look for the "Loading configuration..." message when running the script
