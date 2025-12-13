/**
 * UI Configuration Service
 * Fetches and caches UI configuration from backend
 */

export interface TabLabels {
  name: string;
  title: string;
  subtitle?: string;
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
  labels: TabLabels;
  children?: PowerBIReportChild[];
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
  // Return in-memory cached config if available
  if (cachedConfig) {
    return cachedConfig;
  }

  // Try to get from session storage
  const storedConfig = getCachedConfigFromStorage();
  if (storedConfig) {
    cachedConfig = storedConfig;
    return cachedConfig;
  }

  try {
    const backendUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
    const response = await fetch(`${backendUrl}/api/config/ui`);
    
    if (!response.ok) {
      console.warn('Failed to fetch UI config, using defaults');
      cachedConfig = {
        version: '1.0.0',
        environment: 'prod',
        tabs: tabsToMap(defaultTabConfigs),
      };
      saveCachedConfigToStorage(cachedConfig);
      return cachedConfig;
    }

    const data: UIConfigResponse = await response.json();
    cachedConfig = {
      version: data.version,
      environment: data.environment,
      tabs: tabsToMap(data.tabs),
    };
    saveCachedConfigToStorage(cachedConfig);
    return cachedConfig;
  } catch (error) {
    console.error('Error fetching UI config:', error);
    cachedConfig = {
      version: '1.0.0',
      environment: 'prod',
      tabs: tabsToMap(defaultTabConfigs),
    };
    saveCachedConfigToStorage(cachedConfig);
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
export function shouldDisplayTab(uiConfig: UIConfig, tabId: string): boolean {
  const tab = uiConfig.tabs.get(tabId);
  return tab ? tab.display : false;
}

/**
 * Clear cached UI configuration (useful for testing or refresh)
 */
export function clearUIConfigCache(): void {
  cachedConfig = null;
}
