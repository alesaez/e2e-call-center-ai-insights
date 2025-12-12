# UI Configuration Guide

## Overview

The application uses a JSON-based UI configuration system (`ui-config.json`) that allows you to control which features are displayed and loaded, customize tab labels (name, title, subtitle), and apply environment-specific overrides (dev, staging, prod).

## Configuration Files

### 1. `backend/ui-config.json` (Primary Configuration)

This is the main configuration file that controls all UI aspects:

```json
{
  "version": "1.0.0",
  "defaultEnvironment": "prod",
  "environments": {
    "dev": {},
    "staging": {},
    "prod": {}
  },
  "tabs": [
    {
      "id": "dashboard",
      "display": true,
      "load": true,
      "labels": {
        "name": "Dashboard",
        "title": "Dashboard",
        "subtitle": "Overview of all metrics"
      },
      "overrides": {
        "dev": {
          "labels": {
            "subtitle": "Development environment"
          }
        }
      },
      "meta": {
        "owner": "app-shell",
        "description": "Main dashboard view"
      }
    }
  ]
}
```

### 2. `backend/.env` (Environment Selection)

Set which environment to use from `ui-config.json`:

```bash
# UI Configuration Environment (dev, staging, prod)
UI_CONFIG_ENVIRONMENT=prod
```

## Configuration Schema

### Tab Configuration

Each tab in the `tabs` array has the following structure:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique identifier (`dashboard`, `copilot-studio`, `ai-foundry`, `powerbi`, `settings`) |
| `display` | boolean | Yes | Show this tab in the navigation (true/false) |
| `load` | boolean | Yes | Load the backend service for this tab (true/false) |
| `labels.name` | string | Yes | Tab name shown in navigation sidebar |
| `labels.title` | string | Yes | Title shown in the tab view |
| `labels.subtitle` | string | No | Subtitle shown below the title |
| `overrides` | object | No | Environment-specific overrides (dev, staging, prod) |
| `meta` | object | No | Metadata (owner, description) |

### Tab IDs

| ID | Route | Service | Description |
|----|-------|---------|-------------|
| `dashboard` | `/dashboard` | None | Main dashboard view |
| `copilot-studio` | `/chatbot` | Copilot Studio | Microsoft Copilot Studio chatbot |
| `ai-foundry` | `/ai-foundry` | AI Foundry | Azure AI Foundry chatbot |
| `powerbi` | `/powerbi` | Power BI | Embedded Power BI reports |
| `settings` | `/settings` | None | Application settings |

## How It Works

### 1. Backend Initialization

When the backend starts:
1. Reads `UI_CONFIG_ENVIRONMENT` from `.env` (defaults to `prod`)
2. Loads `ui-config.json`
3. Applies environment-specific overrides
4. Conditionally initializes services based on `load` flag

**Example logs:**
```
✓ UI Configuration loaded: version=1.0.0, environment=prod
✓ Copilot Studio configured: environment_id=..., schema_name=...
ℹ Power BI disabled by UI configuration
```

### 2. Frontend Initialization

The frontend:
1. Fetches configuration from `/api/config/ui`
2. Conditionally renders routes based on `display` flag
3. Uses custom labels for tab names, titles, and subtitles

### 3. Environment Overrides

Overrides merge with base configuration:

```json
{
  "id": "copilot-studio",
  "display": true,
  "labels": {
    "name": "Chatbot",
    "title": "Copilot Studio",
    "subtitle": "AI-powered support"
  },
  "overrides": {
    "dev": {
      "display": false,         // Hide in dev
      "labels": {
        "subtitle": "Testing"   // Only override subtitle
      }
    }
  }
}
```

Result in `dev` environment:
- `display`: `false` (from override)
- `load`: `true` (from base - not overridden)
- `labels.name`: `"Chatbot"` (from base)
- `labels.title`: `"Copilot Studio"` (from base)
- `labels.subtitle`: `"Testing"` (from override)

## Use Cases

### Example 1: Disable Feature Completely

Hide Copilot Studio and don't load its backend service:

```json
{
  "id": "copilot-studio",
  "display": false,
  "load": false,
  "labels": { ... }
}
```

**Result:**
- "Chatbot" tab hidden from navigation
- Copilot Studio service not initialized
- No Copilot Studio configuration required

### Example 2: Custom Labels Per Environment

Different tab names in dev vs prod:

```json
{
  "id": "copilot-studio",
  "display": true,
  "load": true,
  "labels": {
    "name": "Chatbot",
    "title": "Customer Support",
    "subtitle": "AI-powered assistance"
  },
  "overrides": {
    "dev": {
      "labels": {
        "name": "Chatbot (Dev)",
        "title": "Support Bot - Development",
        "subtitle": "Testing environment"
      }
    }
  }
}
```

**Result in dev:**
- Sidebar shows "Chatbot (Dev)"
- Title shows "Support Bot - Development"
- Subtitle shows "Testing environment"

### Example 3: Hide Feature in Specific Environment

Show Power BI only in production:

```json
{
  "id": "powerbi",
  "display": true,
  "load": true,
  "labels": { ... },
  "overrides": {
    "dev": {
      "display": false,
      "load": false
    },
    "staging": {
      "display": false,
      "load": false
    }
  }
}
```

**Result:**
- Dev: Power BI hidden, service not loaded
- Staging: Power BI hidden, service not loaded
- Prod: Power BI visible and loaded

### Example 4: Multi-Tenant Setup

Deploy multiple instances with different configurations:

**Tenant A (Internal IT):**
```json
{
  "tabs": [
    {"id": "dashboard", "display": true, "load": true, ...},
    {"id": "ai-foundry", "display": true, "load": true, 
     "labels": {"name": "IT Assistant", ...}},
    {"id": "copilot-studio", "display": false, "load": false, ...},
    {"id": "powerbi", "display": false, "load": false, ...}
  ]
}
```

**Tenant B (Customer Support):**
```json
{
  "tabs": [
    {"id": "copilot-studio", "display": true, "load": true,
     "labels": {"name": "Support Bot", ...}},
    {"id": "powerbi", "display": true, "load": true, ...},
    {"id": "ai-foundry", "display": false, "load": false, ...}
  ]
}
```

## API Endpoints

### GET /api/config/ui

Returns the current UI configuration with environment overrides applied.

**Response:**
```json
{
  "version": "1.0.0",
  "environment": "prod",
  "tabs": [
    {
      "id": "dashboard",
      "display": true,
      "load": true,
      "labels": {
        "name": "Dashboard",
        "title": "Dashboard",
        "subtitle": "Overview of all metrics"
      }
    },
    {
      "id": "copilot-studio",
      "display": false,
      "load": false,
      "labels": {
        "name": "Chatbot",
        "title": "Copilot Studio",
        "subtitle": "AI-powered support"
      }
    }
  ]
}
```

### GET /api/config/features (Legacy)

**DEPRECATED:** Use `/api/config/ui` instead.

Provided for backwards compatibility. Maps new UI config to old format.

## Deployment Scenarios

### Scenario 1: Development Environment

Set `UI_CONFIG_ENVIRONMENT=dev` in `.env`

Customize `ui-config.json`:
```json
{
  "tabs": [
    {
      "id": "dashboard",
      "overrides": {
        "dev": {
          "labels": {"subtitle": "Development mode"}
        }
      }
    }
  ]
}
```

### Scenario 2: Production - Support Team

```json
{
  "tabs": [
    {"id": "copilot-studio", "display": true, "load": true,
     "labels": {"name": "Support Chat", "title": "Customer Support"}},
    {"id": "dashboard", "display": false, "load": false},
    {"id": "ai-foundry", "display": false, "load": false},
    {"id": "powerbi", "display": false, "load": false}
  ]
}
```

### Scenario 3: Production - Analytics Team

```json
{
  "tabs": [
    {"id": "dashboard", "display": true, "load": true},
    {"id": "powerbi", "display": true, "load": true,
     "labels": {"name": "Reports", "title": "Analytics Dashboard"}},
    {"id": "copilot-studio", "display": false, "load": false},
    {"id": "ai-foundry", "display": false, "load": false}
  ]
}
```

## Migration from Old System

If you previously used environment variables (`FEATURE_ENABLE_*`, `FEATURE_*_TAB_NAME`), migrate to `ui-config.json`:

**Old (.env):**
```bash
FEATURE_ENABLE_COPILOT_STUDIO=false
FEATURE_AI_FOUNDRY_TAB_NAME=AI Assistant
```

**New (ui-config.json):**
```json
{
  "tabs": [
    {
      "id": "copilot-studio",
      "display": false,
      "load": false
    },
    {
      "id": "ai-foundry",
      "labels": {
        "name": "AI Assistant"
      }
    }
  ]
}
```

## Troubleshooting

### Tab Not Appearing

1. Check `display` is `true` in `ui-config.json`
2. Check environment overrides haven't disabled it
3. Verify `UI_CONFIG_ENVIRONMENT` in `.env`
4. Clear browser cache (Ctrl+Shift+R)

### Service Not Loading

1. Check `load` is `true` in `ui-config.json`
2. Check environment overrides
3. Verify required configuration (e.g., `COPILOT_STUDIO_*`)
4. Check backend startup logs

### Labels Not Updating

1. Restart backend to reload `ui-config.json`
2. Clear frontend cache
3. Check network tab for `/api/config/ui` response

## Benefits

### Flexibility
- Single JSON file for all UI configuration
- Environment-specific overrides
- No code changes required

### Multi-Tenant Support
- Different `ui-config.json` per deployment
- Customize labels per customer
- Show/hide features per tenant

### Performance
- Services not loaded if `load: false`
- Reduced memory footprint
- Faster startup time

### User Experience
- Customized navigation labels
- Titles and subtitles for context
- Simplified interface (only relevant tabs)

## Advanced: Schema Extension

You can extend the schema for custom use cases:

```json
{
  "tabs": [
    {
      "id": "custom-feature",
      "display": true,
      "load": true,
      "labels": {
        "name": "My Feature",
        "title": "Custom Feature",
        "subtitle": "Description"
      },
      "meta": {
        "owner": "my-team",
        "description": "Custom feature",
        "customField": "custom value"
      }
    }
  ]
}
```

## References

- Backend: `backend/ui_config.py` - UIConfigManager class
- Backend: `backend/config.py` - Settings integration
- Backend: `backend/main.py` - `/api/config/ui` endpoint
- Backend: `backend/ui-config.json` - Configuration file
- Frontend: `frontend/src/services/featureConfig.ts` - Service
- Frontend: `frontend/src/App.tsx` - Conditional routing
- Frontend: `frontend/src/components/MainLayout.tsx` - Dynamic navigation
