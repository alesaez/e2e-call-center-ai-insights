# Static Assets

This folder contains static assets for the Call Center AI Insights application.

## Logo Setup

1. **Place your logo file** in this `public` folder (e.g., `logo.png`, `logo.svg`)
2. **Update the logoUrl** in `src/theme/theme.ts`:
   ```typescript
   logoUrl: '/logo.png'  // References public/logo.png
   ```

## Favicon Setup

1. **Place your favicon files** in this `public` folder:
   - `favicon.svg` (modern browsers, scalable)
   - `favicon.png` (fallback, 32x32px recommended)
   - Optional: `favicon.ico` (legacy browsers)

2. **Favicon is already configured** in `index.html`:
   ```html
   <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
   <link rel="icon" type="image/png" href="/favicon.png" />
   ```

## Supported Formats
- **SVG** (recommended for scalability)
- **PNG** (with transparent background)
- **JPG/JPEG**

## Logo Guidelines
- **Max height**: 40px (automatically scaled)
- **Max width**: 200px (will fit container)
- **Background**: Transparent or white recommended
- **Format**: SVG preferred for crisp display at all sizes

## Current Configuration
The logo is currently set to an external URL. To use a local logo:
1. Add your logo file to this folder
2. Update `logoUrl` in `defaultTenantConfig`
3. Restart the development server