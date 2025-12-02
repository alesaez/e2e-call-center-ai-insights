/**
 * Tenant Configuration
 * Loads tenant-specific settings from environment variables
 */

export interface TenantConfig {
  tenantId: string;
  name: string;
  logo?: string;
  logoUrl?: string;
  faviconUrl?: string;
  primaryColor: string;
  secondaryColor: string;
}

/**
 * Load tenant configuration from environment variables
 */
export const loadTenantConfig = (): TenantConfig => {
  return {
    tenantId: import.meta.env.VITE_TENANT_ID || 'default',
    name: import.meta.env.VITE_TENANT_NAME || 'Call Center AI Insights',
    logo: import.meta.env.VITE_TENANT_LOGO_PATH, // Local path relative to public folder
    logoUrl: import.meta.env.VITE_TENANT_LOGO_URL, // External URL
    faviconUrl: import.meta.env.VITE_TENANT_FAVICON_URL, // URL or path to favicon
    primaryColor: import.meta.env.VITE_TENANT_PRIMARY_COLOR || '#0078d4', // Microsoft blue
    secondaryColor: import.meta.env.VITE_TENANT_SECONDARY_COLOR || '#2b88d8', // Lighter blue
  };
};

/**
 * Get the logo source (URL or local path)
 * Priority: logoUrl > logo (local path)
 */
export const getLogoSrc = (config: TenantConfig): string | undefined => {
  if (config.logoUrl) {
    return config.logoUrl;
  }
  if (config.logo) {
    // If local path, prepend with base URL
    return config.logo.startsWith('/') ? config.logo : `/${config.logo}`;
  }
  return undefined;
};

/**
 * Apply favicon dynamically
 */
export const applyFavicon = (faviconUrl?: string): void => {
  if (!faviconUrl) return;

  // Remove existing favicon links
  const existingLinks = document.querySelectorAll("link[rel*='icon']");
  existingLinks.forEach(link => link.remove());

  // Add new favicon
  const link = document.createElement('link');
  link.rel = 'icon';
  link.href = faviconUrl.startsWith('/') || faviconUrl.startsWith('http') 
    ? faviconUrl 
    : `/${faviconUrl}`;
  document.head.appendChild(link);
};

/**
 * Update document title based on tenant config
 */
export const updateDocumentTitle = (title?: string): void => {
  if (title) {
    document.title = title;
  }
};

// Export singleton instance
export const tenantConfig = loadTenantConfig();
