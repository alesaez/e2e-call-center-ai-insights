# Tenant Configuration Guide

This guide explains how to customize the application's branding and appearance using environment variables for white-labeling purposes.

## Overview

The application supports tenant-specific branding including:
- Custom application name/title
- Custom logo (local or external URL)
- Custom favicon
- Custom theme colors (primary and secondary)

## Configuration

All tenant branding is configured through environment variables in your `.env.local` file (for development) or deployment environment variables (for production).

### Environment Variables

#### Tenant Identity
```bash
# Unique identifier for the tenant
VITE_TENANT_ID=default

# Application name (appears in browser title and UI)
VITE_TENANT_NAME=Call Center AI Insights
```

#### Logo Configuration

You can use **either** a local logo file or an external URL:

**Option 1: Local Logo File**
```bash
# Place your logo file in the /public folder
# Then reference it by filename
VITE_TENANT_LOGO_PATH=logo.png
```

**Option 2: External Logo URL**
```bash
# Use an external URL (CDN, blob storage, etc.)
VITE_TENANT_LOGO_URL=https://your-domain.com/assets/logo.png
```

**Priority:** If both are set, `VITE_TENANT_LOGO_URL` takes precedence.

#### Favicon Configuration

```bash
# Path to favicon file (relative to public folder) or external URL
VITE_TENANT_FAVICON_URL=favicon.ico
# Or use external URL:
# VITE_TENANT_FAVICON_URL=https://your-domain.com/favicon.ico
```

#### Theme Colors

```bash
# Primary color (hex format) - used for main UI elements
VITE_TENANT_PRIMARY_COLOR=#0078d4

# Secondary color (hex format) - used for accents
VITE_TENANT_SECONDARY_COLOR=#2b88d8
```

## Setup Instructions

### 1. Development Environment

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Edit `.env.local` and add your tenant configuration:
   ```bash
   # Example configuration for Contoso Corporation
   VITE_TENANT_ID=contoso
   VITE_TENANT_NAME=Contoso Call Center
   VITE_TENANT_LOGO_PATH=contoso-logo.png
   VITE_TENANT_FAVICON_URL=contoso-favicon.ico
   VITE_TENANT_PRIMARY_COLOR=#E81123
   VITE_TENANT_SECONDARY_COLOR=#F25022
   ```

3. Place your logo and favicon files in the `/public` folder:
   ```
   /public
     ├── contoso-logo.png
     └── contoso-favicon.ico
   ```

4. Restart the development server:
   ```bash
   npm run dev
   ```

### 2. Production Deployment

For production deployments, set environment variables in your hosting platform:

**Azure Static Web Apps:**
- Go to Configuration → Application Settings
- Add each `VITE_*` variable

**Vercel/Netlify:**
- Go to Project Settings → Environment Variables
- Add each variable

**Docker:**
```dockerfile
ENV VITE_TENANT_ID=production-tenant
ENV VITE_TENANT_NAME="My Company"
ENV VITE_TENANT_LOGO_URL=https://cdn.mycompany.com/logo.png
ENV VITE_TENANT_FAVICON_URL=https://cdn.mycompany.com/favicon.ico
ENV VITE_TENANT_PRIMARY_COLOR=#FF6B35
ENV VITE_TENANT_SECONDARY_COLOR=#F7931E
```

## Logo Guidelines

### Recommended Specifications

**Logo:**
- Format: PNG, SVG (with transparency), or JPG
- Max height: 40px (will be scaled to fit)
- Recommended width: 120-200px
- Aspect ratio: Maintain original for best results

**Favicon:**
- Format: ICO, PNG, or SVG
- Size: 16x16, 32x32, or 48x48 pixels
- Background: Solid color or transparent

### Example Logo Placements

The logo appears in:
1. **Sidebar** - Top section (40px max height)
2. **Mobile menu** - When drawer is collapsed

## Color Customization

### Choosing Colors

Colors should be specified in hex format (`#RRGGBB`):
- `#0078d4` - Microsoft Blue
- `#E81123` - Microsoft Red
- `#107C10` - Microsoft Green

### Color Usage

**Primary Color:**
- App bar background
- Button primary state
- Active navigation items
- Links

**Secondary Color:**
- Hover states
- Secondary buttons
- Accents and highlights

### Testing Colors

Use these tools to test your color scheme:
- [Coolors](https://coolors.co/) - Generate color palettes
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/) - Ensure accessibility
- [Adobe Color](https://color.adobe.com/) - Create color schemes

## Default Configuration

If no tenant configuration is provided, the application uses these defaults:

```typescript
{
  tenantId: 'default',
  name: 'Call Center AI Insights',
  primaryColor: '#0078d4',  // Microsoft Blue
  secondaryColor: '#2b88d8', // Light Blue
  logo: undefined,
  logoUrl: undefined,
  faviconUrl: undefined
}
```

## Advanced Configuration

### Dynamic Logo Loading

For advanced scenarios, you can implement backend-driven logo loading:

1. Modify `getTenantConfig()` in `src/theme/theme.ts`
2. Fetch tenant configuration from your backend API
3. Return configuration based on authenticated user's tenant

Example:
```typescript
export const getTenantConfig = async (tenantId?: string): Promise<TenantConfig> => {
  // Fetch from backend
  const response = await apiClient.get(`/api/tenant/config/${tenantId}`);
  return response.data;
};
```

### Multiple Tenant Support

To support multiple tenants in a single deployment:

1. Store tenant configurations in backend database
2. Identify tenant by:
   - Subdomain (tenant1.yourapp.com)
   - User authentication (user's tenant ID)
   - URL parameter (?tenant=tenant1)
3. Fetch appropriate configuration on app load

## Troubleshooting

### Logo Not Appearing

1. **Check file path:** Ensure logo file is in `/public` folder
2. **Check console:** Look for 404 errors in browser console
3. **Verify env variable:** Ensure `VITE_TENANT_LOGO_PATH` or `VITE_TENANT_LOGO_URL` is set
4. **Restart dev server:** Environment changes require restart

### Colors Not Applying

1. **Verify hex format:** Must be 6-digit hex with # prefix
2. **Check spelling:** Variable names are case-sensitive
3. **Clear cache:** Browser may cache old theme
4. **Check console:** Look for theme creation errors

### Favicon Not Updating

1. **Clear browser cache:** Favicons are heavily cached
2. **Hard refresh:** Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
3. **Check file format:** Use .ico or .png format
4. **Verify file exists:** Check `/public` folder

## Examples

### Example 1: Contoso Corporation
```bash
VITE_TENANT_ID=contoso
VITE_TENANT_NAME=Contoso Call Center
VITE_TENANT_LOGO_PATH=contoso-logo.png
VITE_TENANT_FAVICON_URL=contoso-favicon.ico
VITE_TENANT_PRIMARY_COLOR=#E81123
VITE_TENANT_SECONDARY_COLOR=#F25022
```

### Example 2: Fabrikam Inc. (Using CDN)
```bash
VITE_TENANT_ID=fabrikam
VITE_TENANT_NAME=Fabrikam Customer Support
VITE_TENANT_LOGO_URL=https://cdn.fabrikam.com/logo-light.png
VITE_TENANT_FAVICON_URL=https://cdn.fabrikam.com/favicon.ico
VITE_TENANT_PRIMARY_COLOR=#00BCF2
VITE_TENANT_SECONDARY_COLOR=#0078D4
```

### Example 3: Minimal Configuration
```bash
VITE_TENANT_NAME=My Call Center
VITE_TENANT_PRIMARY_COLOR=#673AB7
```

## Related Files

- `frontend/src/config/tenantConfig.ts` - Configuration loader
- `frontend/src/theme/theme.ts` - Theme creation
- `frontend/src/App.tsx` - Configuration initialization
- `frontend/src/components/MainLayout.tsx` - Logo rendering
- `frontend/.env.local` - Development configuration
- `frontend/.env.example` - Configuration template

## Support

For additional help with tenant configuration, please refer to:
- Main README.md
- Azure deployment documentation
- Material-UI theming documentation
