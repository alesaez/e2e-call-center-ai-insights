# Quick Start: Tenant Branding

## 🚀 5-Minute Setup Guide

### Step 1: Update Environment Variables

Edit `frontend/.env.local`:

```bash
# Change the app name
VITE_TENANT_NAME=Your Company Name

# Change the colors (hex format)
VITE_TENANT_PRIMARY_COLOR='#YOUR_COLOR'
VITE_TENANT_SECONDARY_COLOR='#YOUR_COLOR'
```

### Step 2: Add Your Logo (Optional)

**Option A: Use Local File**
1. Place `your-logo.png` in `frontend/public/` folder
2. Add to `.env.local`:
   ```bash
   VITE_TENANT_LOGO_PATH=your-logo.png
   ```

**Option B: Use External URL**
Add to `.env.local`:
```bash
VITE_TENANT_LOGO_URL=https://your-cdn.com/logo.png
```

### Step 3: Add Favicon (Optional)

1. Place `your-favicon.ico` in `frontend/public/` folder
2. Add to `.env.local`:
   ```bash
   VITE_TENANT_FAVICON_URL=your-favicon.ico
   ```

### Step 4: Restart & Test

```bash
cd frontend
npm run dev
```

Open http://localhost:3000 and verify:
- ✅ App name in browser title
- ✅ Logo in sidebar
- ✅ Favicon in browser tab
- ✅ Colors applied to UI

## 📋 Example Configurations

### Minimal (Just Colors)
```bash
VITE_TENANT_NAME=My Call Center
VITE_TENANT_PRIMARY_COLOR=#9C27B0
VITE_TENANT_SECONDARY_COLOR=#BA68C8
```

### Full Branding (Local Assets)
```bash
VITE_TENANT_NAME=Contoso Corporation
VITE_TENANT_LOGO_PATH=contoso-logo.png
VITE_TENANT_FAVICON_URL=contoso-favicon.ico
VITE_TENANT_PRIMARY_COLOR=#E81123
VITE_TENANT_SECONDARY_COLOR=#F25022
```

### CDN-Hosted Assets
```bash
VITE_TENANT_NAME=Fabrikam Inc
VITE_TENANT_LOGO_URL=https://cdn.fabrikam.com/logo.svg
VITE_TENANT_FAVICON_URL=https://cdn.fabrikam.com/favicon.ico
VITE_TENANT_PRIMARY_COLOR=#00BCF2
```

## 🎨 Choosing Colors

Use these tools:
- [Coolors.co](https://coolors.co/) - Generate palettes
- [Adobe Color](https://color.adobe.com/) - Color harmony
- [Material Design Colors](https://materialui.co/colors/) - Pre-made palettes

Colors must be in hex format: `#RRGGBB`

## 📁 File Requirements

### Logo
- Format: PNG, SVG, or JPG
- Max height: 40px (auto-scaled)
- Recommended: 120-200px wide
- Background: Transparent preferred

### Favicon
- Format: ICO or PNG
- Size: 16x16, 32x32, or 48x48
- File size: < 50KB

## 🐛 Troubleshooting

**Logo not showing?**
- Check file is in `/public` folder
- Verify environment variable name
- Restart dev server

**Favicon not updating?**
- Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
- Clear browser cache

**Colors not applied?**
- Check hex format (must start with #)
- Ensure 6 digits: `#0078d4` not `#078d4`
- Restart dev server

## 📚 Full Documentation

For advanced configuration, see:
- [TENANT-CONFIGURATION.md](./TENANT-CONFIGURATION.md) - Complete guide
- [public/ASSETS-README.md](./public/ASSETS-README.md) - Asset guidelines
- [.env.example](./.env.example) - All available variables

## ✨ That's It!

Your app is now branded with your company's identity.
