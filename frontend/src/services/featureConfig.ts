/**
 * UI Configuration Service
 * Fetches and caches UI configuration from backend
 */

export interface TabLabels {
  name: string;
  title: string;
  subtitle?: string;
}

export interface TabConfig {
  id: string;
  display: boolean;
  load: boolean;
  labels: TabLabels;
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

// Cache for UI configuration
let cachedConfig: UIConfig | null = null;

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
  // Return cached config if available
  if (cachedConfig) {
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
      return cachedConfig;
    }

    const data: UIConfigResponse = await response.json();
    cachedConfig = {
      version: data.version,
      environment: data.environment,
      tabs: tabsToMap(data.tabs),
    };
    return cachedConfig;
  } catch (error) {
    console.error('Error fetching UI config:', error);
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
