# Static Assets

This folder contains static assets for the Call Center AI Insights application.

## Logo Setup (Environment-based Configuration)

### Using Local Logo Files

1. **Place your logo file** in this `public` folder (e.g., `logo.png`, `logo.svg`)

2. **Update `.env.local`**:
   ```bash
   VITE_TENANT_LOGO_PATH=logo.png
   ```
   Note: Path is relative to this `public` folder

3. **Restart development server** for changes to take effect

### Using External Logo URL

**Update `.env.local`**:
```bash
VITE_TENANT_LOGO_URL=https://your-cdn.com/logo.png
```

**Priority:** If both `VITE_TENANT_LOGO_PATH` and `VITE_TENANT_LOGO_URL` are set, the URL takes precedence.

## Favicon Setup

### Using Local Favicon

1. **Place your favicon files** in this `public` folder:
   - `favicon.svg` (modern browsers, scalable)
   - `favicon.png` (fallback, 32x32px recommended)
   - `favicon.ico` (legacy browsers)

2. **Update `.env.local`**:
   ```bash
   VITE_TENANT_FAVICON_URL=favicon.ico
   ```

### Using External Favicon URL

```bash
VITE_TENANT_FAVICON_URL=https://your-cdn.com/favicon.ico
```

**Note:** The favicon is applied dynamically at runtime via JavaScript.

## Supported Formats

### Logo Files
- **SVG** (recommended for scalability and crisp display)
- **PNG** (with transparent background preferred)
- **JPG/JPEG** (solid background)

### Favicon Files
- **ICO** (legacy browsers, multi-resolution)
- **PNG** (16x16, 32x32, or 48x48)
- **SVG** (modern browsers, scalable)

## Logo Guidelines

- **Max height**: 40px (automatically scaled in UI)
- **Max width**: 200px (will fit container)
- **Background**: Transparent or white recommended
- **Format**: SVG preferred for crisp display at all sizes
- **File size**: Keep under 100KB for fast loading

## Favicon Guidelines

- **Size**: 16x16, 32x32, or 48x48 pixels
- **Format**: .ico for maximum compatibility
- **Background**: Solid color or transparent
- **File size**: Keep under 50KB

## Example Configuration

Add to your `.env.local`:

```bash
# Local files (place in this /public folder)
VITE_TENANT_LOGO_PATH=my-company-logo.png
VITE_TENANT_FAVICON_URL=my-company-favicon.ico

# OR use external URLs
VITE_TENANT_LOGO_URL=https://cdn.mycompany.com/logo.svg
VITE_TENANT_FAVICON_URL=https://cdn.mycompany.com/favicon.ico
```

## Folder Structure

```
/public
  ├── logo.png              # Your custom logo (example)
  ├── favicon.ico           # Your custom favicon (example)
  ├── favicon.svg           # Default SVG favicon
  ├── logo-placeholder.svg  # Placeholder logo
  └── README.md             # This file
```

## Testing Your Changes

1. Add files to this folder
2. Update `.env.local` with paths
3. Restart dev server: `npm run dev`
4. Open app in browser
5. Check logo in sidebar and favicon in browser tab

## Troubleshooting

**Logo not showing:**
- Verify file exists in `/public` folder
- Check browser console for 404 errors
- Ensure environment variable name is correct
- Restart development server

**Favicon not updating:**
- Clear browser cache (Ctrl+Shift+R or Cmd+Shift+R)
- Check file format (use .ico for best compatibility)
- Verify path in `.env.local`

## See Also

- [TENANT-CONFIGURATION.md](../TENANT-CONFIGURATION.md) - Complete tenant branding guide
- `.env.example` - Environment variable template
