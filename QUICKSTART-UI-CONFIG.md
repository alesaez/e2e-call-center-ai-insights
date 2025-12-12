# Quick Start: UI Configuration

## What is this?

The UI configuration system allows you to customize your application's tabs, labels, and features using a simple JSON file (`backend/ui-config.json`).

## Common Tasks

### 1. Hide a Tab

Edit `backend/ui-config.json`:

```json
{
  "id": "powerbi",
  "display": false,  // ← Hide from navigation
  "load": false      // ← Don't load backend service
}
```

### 2. Rename a Tab

Edit `backend/ui-config.json`:

```json
{
  "id": "copilot-studio",
  "labels": {
    "name": "Support Bot",           // ← Sidebar name
    "title": "Customer Support",     // ← Page title
    "subtitle": "AI-powered help"    // ← Description
  }
}
```

### 3. Different Config Per Environment

Edit `backend/ui-config.json`:

```json
{
  "id": "ai-foundry",
  "display": true,
  "labels": {"name": "AI Foundry"},
  "overrides": {
    "dev": {
      "labels": {
        "name": "AI Foundry (Dev)",      // ← Only in dev
        "subtitle": "Development mode"
      }
    }
  }
}
```

Then in `backend/.env`:
```bash
UI_CONFIG_ENVIRONMENT=dev  # or staging, or prod
```

### 4. Minimal Setup (Just Dashboard)

Edit `backend/ui-config.json` - set all tabs except dashboard and settings to:

```json
{
  "id": "copilot-studio",
  "display": false,
  "load": false
}
```

## File Locations

- **Configuration**: `backend/ui-config.json`
- **Environment**: `backend/.env` (set `UI_CONFIG_ENVIRONMENT`)
- **Documentation**: `backend/UI-CONFIG-README.md`
- **Full Docs**: `docs/FEATURE_CONFIGURATION.md`

## After Editing

1. Save `backend/ui-config.json`
2. Restart the backend
3. Refresh your browser (Ctrl+Shift+R)

## Available Tab IDs

- `dashboard` - Main dashboard page
- `copilot-studio` - Copilot Studio chatbot
- `ai-foundry` - Azure AI Foundry chatbot
- `powerbi` - Power BI reports
- `settings` - Application settings (always visible)

## Example Configurations

### Support Team Only
```json
{
  "tabs": [
    {"id": "copilot-studio", "display": true, "load": true},
    {"id": "dashboard", "display": false, "load": false},
    {"id": "ai-foundry", "display": false, "load": false},
    {"id": "powerbi", "display": false, "load": false},
    {"id": "settings", "display": true, "load": false}
  ]
}
```

### Analytics Team Only
```json
{
  "tabs": [
    {"id": "dashboard", "display": true, "load": true},
    {"id": "powerbi", "display": true, "load": true},
    {"id": "copilot-studio", "display": false, "load": false},
    {"id": "ai-foundry", "display": false, "load": false},
    {"id": "settings", "display": true, "load": false}
  ]
}
```

## Troubleshooting

**Changes not appearing?**
- Restart the backend
- Hard refresh browser (Ctrl+Shift+R)
- Check backend logs for errors

**Service won't load?**
- Check required environment variables are set
- Check backend startup logs
- Verify JSON syntax is valid

**Need more help?**
- See `backend/UI-CONFIG-README.md`
- See `docs/FEATURE_CONFIGURATION.md`
