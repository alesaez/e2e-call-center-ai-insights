/**
 * UI Configuration Service
 * Fetches and caches UI configuration from backend
 */

import apiClient from './apiClient';

export interface TabLabels {
  name: string;
  title: string;
  subtitle?: string;
}

export interface PredefinedQuestion {
  id: string;
  title: string;
  question: string;
  category: string;
  icon?: string;
}

export interface PowerBIReportChild {
  id: string;
  reportId: string;
  workspaceId: string;
  labels: TabLabels;
}

export interface TabConfig {
  id: string;
  display: boolean;
  load: boolean;
  icon?: string;
  labels: TabLabels;
  children?: PowerBIReportChild[];
  predefinedQuestions?: PredefinedQuestion[];
}

export interface UIConfigResponse {
  version: string;
  environment: string;
  tabs: TabConfig[];
}

export interface UIConfig {
  version: string;
  environment: string;
  tabs: Map<string, TabConfig>;
}

// Default configuration (used as fallback)
const defaultTabConfigs: TabConfig[] = [
  {
    id: 'dashboard',
    display: true,
    load: true,
    labels: {
      name: 'Dashboard',
      title: 'Dashboard',
      subtitle: 'Overview of all metrics',
    },
  },
  {
    id: 'copilot-studio',
    display: true,
    load: true,
    labels: {
      name: 'Chatbot',
      title: 'Copilot Studio',
      subtitle: 'AI-powered customer service',
    },
  },
  {
    id: 'ai-foundry',
    display: true,
    load: true,
    labels: {
      name: 'AI Foundry',
      title: 'Azure AI Foundry',
      subtitle: 'Advanced AI capabilities',
    },
  },
  {
    id: 'powerbi',
    display: true,
    load: true,
    labels: {
      name: 'Power BI Report',
      title: 'Analytics Dashboard',
      subtitle: 'Business intelligence insights',
    },
  },
  {
    id: 'powerbi-reports',
    display: true,
    load: true,
    labels: {
      name: 'Power BI Reports',
      title: 'Power BI Reports',
      subtitle: 'Multiple embedded reports',
    },
    children: [],
  },
  {
    id: 'settings',
    display: true,
    load: false,
    labels: {
      name: 'Settings',
      title: 'Configuration',
      subtitle: 'Manage your preferences',
    },
  },
];

// Cache key for session storage
const CACHE_KEY = 'ui_config_cache';
const VERSION_VALIDATED_KEY = 'ui_config_version_validated';

// In-memory cache for UI configuration
let cachedConfig: UIConfig | null = null;

/**
 * Get cached config from session storage
 */
function getCachedConfigFromStorage(): UIConfig | null {
  try {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      // Reconstruct the Map from the array
      return {
        version: parsed.version,
        environment: parsed.environment,
        tabs: tabsToMap(parsed.tabs),
      };
    }
  } catch (error) {
    console.warn('Failed to parse cached UI config:', error);
  }
  return null;
}

/**
 * Save config to session storage
 */
function saveCachedConfigToStorage(config: UIConfig): void {
  try {
    // Convert Map to array for JSON serialization
    const serializable = {
      version: config.version,
      environment: config.environment,
      tabs: Array.from(config.tabs.values()),
    };
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(serializable));
  } catch (error) {
    console.warn('Failed to cache UI config:', error);
  }
}

/**
 * Convert tab array to Map for easy lookup
 */
function tabsToMap(tabs: TabConfig[]): Map<string, TabConfig> {
  const map = new Map<string, TabConfig>();
  tabs.forEach(tab => map.set(tab.id, tab));
  return map;
}

/**
 * Fetch UI configuration from backend
 */
export async function getUIConfig(): Promise<UIConfig> {
  // For security: Always validate access before returning cached config
  // Try to fetch from backend - this will throw 403 if user has no permissions
  try {
    const response = await apiClient.get<UIConfigResponse>('/api/config/ui');
    
    const data: UIConfigResponse = response.data;
    cachedConfig = {
      version: data.version,
      environment: data.environment,
      tabs: tabsToMap(data.tabs),
    };
    saveCachedConfigToStorage(cachedConfig);
    return cachedConfig;
  } catch (error: any) {
    console.error('Error fetching UI config:', error);
    
    // If it's a 403 or 401, don't use fallback or cache - throw the error
    // This indicates the user doesn't have permission to access the app
    if (error.response?.status === 403 || error.response?.status === 401) {
      console.error('Access denied - no permissions to load UI config');
      // Clear any cached config since user doesn't have access
      clearUIConfigCache();
      throw error; // Re-throw to let App.tsx handle it
    }
    
    // For other errors (network issues, etc.), try to use cached config
    const storedConfig = getCachedConfigFromStorage();
    if (storedConfig) {
      console.warn('Using cached config due to network error');
      if (!cachedConfig) {
        cachedConfig = storedConfig;
      }
      return cachedConfig;
    }
    
    // If no cache available, use fallback config
    console.warn('Using fallback config due to error');
    cachedConfig = {
      version: '1.0.0',
      environment: 'prod',
      tabs: tabsToMap(defaultTabConfigs),
    };
    return cachedConfig;
  }
}

/**
 * Get configuration for a specific tab
 */
export function getTabConfig(uiConfig: UIConfig, tabId: string): TabConfig | undefined {
  return uiConfig.tabs.get(tabId);
}

/**
 * Get all visible tabs
 */
export function getVisibleTabs(uiConfig: UIConfig): TabConfig[] {
  return Array.from(uiConfig.tabs.values()).filter(tab => tab.display);
}

/**
 * Check if a tab should be displayed
 */
export function shouldDisplayTab(uiConfig: UIConfig | null, tabId: string): boolean {
  if (!uiConfig) return false;
  const tab = uiConfig.tabs.get(tabId);
  return tab ? tab.display : false;
}

/**
 * Get the default route based on enabled tabs
 * Returns the first available enabled tab or settings as fallback
 */
export function getDefaultRoute(uiConfig: UIConfig | null): string {
  if (!uiConfig) return '/login';
  
  // Get the first visible tab from the config
  const visibleTabs = getVisibleTabs(uiConfig);
  
  if (visibleTabs.length > 0) {
    const firstTab = visibleTabs[0];
    
    // Map tab IDs to their routes
    switch (firstTab.id) {
      case 'dashboard':
        return '/dashboard';
      case 'copilot-studio':
        return '/chatbot';
      case 'ai-foundry':
        return '/ai-foundry';
      case 'powerbi':
        return '/powerbi';
      case 'powerbi-reports':
        // If powerbi-reports has children, go to first child
        if (firstTab.children && firstTab.children.length > 0) {
          return `/powerbi-reports/${firstTab.children[0].id}`;
        }
        break;
      case 'settings':
        return '/settings';
    }
  }
  
  // Fallback to settings if nothing else is available
  return '/settings';
}

/**
 * Clear cached UI configuration (useful for testing or refresh)
 */
export function clearUIConfigCache(): void {
  cachedConfig = null;
  sessionStorage.removeItem(CACHE_KEY);
  sessionStorage.removeItem(VERSION_VALIDATED_KEY);
}
