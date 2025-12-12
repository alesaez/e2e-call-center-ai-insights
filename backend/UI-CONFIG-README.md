# UI Configuration Schema

This file controls the user interface configuration, including which tabs are displayed, which backend services are loaded, and tab labels.

## Quick Start

1. Edit this file to customize your UI
2. Set `UI_CONFIG_ENVIRONMENT` in `backend/.env` (dev, staging, or prod)
3. Restart the backend

## Schema

```json
{
  "version": "1.0.0",
  "defaultEnvironment": "prod",
  "environments": {
    "dev": {},
    "staging": {},
    "prod": {}
  },
  "tabs": [...]
}
```

### Tab Configuration

Each tab has the following fields:

- **id** (required): Unique identifier
  - Valid values: `dashboard`, `copilot-studio`, `ai-foundry`, `powerbi`, `settings`

- **display** (required): Show this tab in navigation?
  - `true`: Tab appears in sidebar
  - `false`: Tab hidden from UI

- **load** (required): Load the backend service?
  - `true`: Backend initializes service on startup
  - `false`: Service not loaded (saves resources)

- **labels** (required): Tab display labels
  - **name**: Short name shown in navigation sidebar
  - **title**: Page title shown in main view
  - **subtitle** (optional): Description below title

- **overrides** (optional): Environment-specific overrides
  - Only specified fields are overridden
  - Unspecified fields inherit from base configuration

- **meta** (optional): Metadata for documentation
  - **owner**: Team or component responsible
  - **description**: Purpose of this tab

## Examples

### Hide a feature completely
```json
{
  "id": "powerbi",
  "display": false,
  "load": false,
  "labels": {...}
}
```

### Custom labels
```json
{
  "id": "copilot-studio",
  "display": true,
  "load": true,
  "labels": {
    "name": "Support Chat",
    "title": "Customer Support Bot",
    "subtitle": "Get instant help from our AI assistant"
  }
}
```

### Environment-specific configuration
```json
{
  "id": "ai-foundry",
  "display": true,
  "load": true,
  "labels": {
    "name": "AI Foundry",
    "title": "AI Assistant",
    "subtitle": "Production assistant"
  },
  "overrides": {
    "dev": {
      "display": true,
      "labels": {
        "name": "AI Foundry (Dev)",
        "subtitle": "Development environment"
      }
    },
    "staging": {
      "display": false,
      "load": false
    }
  }
}
```

Result:
- **dev**: Tab shown as "AI Foundry (Dev)" with subtitle "Development environment"
- **staging**: Tab completely hidden, service not loaded
- **prod**: Tab shown as "AI Foundry" with subtitle "Production assistant"

## Best Practices

1. **Service Loading**: Set `load: false` if you don't need the backend service
   - Saves memory and startup time
   - Still requires service configuration to be valid

2. **Environment Overrides**: Only override what changes
   - Base config provides defaults
   - Overrides are merged, not replaced

3. **Labels**: Keep them concise
   - **name**: 1-3 words for sidebar
   - **title**: 2-5 words for page header
   - **subtitle**: 3-8 words for description

4. **Metadata**: Document ownership
   - Helps teams understand responsibilities
   - Not used by the application

## Common Configurations

### Development (All Features)
```json
{
  "tabs": [
    {"id": "dashboard", "display": true, "load": true},
    {"id": "copilot-studio", "display": true, "load": true},
    {"id": "ai-foundry", "display": true, "load": true},
    {"id": "powerbi", "display": true, "load": true},
    {"id": "settings", "display": true, "load": false}
  ]
}
```

### Production (Support Team)
```json
{
  "tabs": [
    {"id": "copilot-studio", "display": true, "load": true, 
     "labels": {"name": "Support Bot", ...}},
    {"id": "dashboard", "display": false, "load": false},
    {"id": "ai-foundry", "display": false, "load": false},
    {"id": "powerbi", "display": false, "load": false},
    {"id": "settings", "display": true, "load": false}
  ]
}
```

### Production (Analytics Team)
```json
{
  "tabs": [
    {"id": "dashboard", "display": true, "load": true},
    {"id": "powerbi", "display": true, "load": true,
     "labels": {"name": "Reports", ...}},
    {"id": "copilot-studio", "display": false, "load": false},
    {"id": "ai-foundry", "display": false, "load": false},
    {"id": "settings", "display": true, "load": false}
  ]
}
```

## Troubleshooting

**Tab not appearing?**
- Check `display: true` in current environment
- Verify no override disabling it
- Check `UI_CONFIG_ENVIRONMENT` in `.env`

**Service not loading?**
- Check `load: true` in current environment
- Verify service configuration (env vars)
- Check backend startup logs

**Labels not updating?**
- Restart backend to reload config
- Clear browser cache
- Check `/api/config/ui` endpoint

## See Also

- Full documentation: `docs/FEATURE_CONFIGURATION.md`
- Environment variables: `backend/.env.example`
- Backend implementation: `backend/ui_config.py`
