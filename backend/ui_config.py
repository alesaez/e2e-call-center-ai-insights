"""
UI Configuration Manager
Loads and processes the ui-config.json file with environment-specific overrides
"""
import json
from pathlib import Path
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field

BASE_DIR = Path(__file__).resolve().parent


class TabLabels(BaseModel):
    """Labels for a tab"""
    name: str
    title: str
    subtitle: Optional[str] = None


class PowerBIReportChild(BaseModel):
    """Configuration for a child Power BI report"""
    id: str
    reportId: str
    workspaceId: str
    labels: TabLabels


class TabOverride(BaseModel):
    """Environment-specific tab overrides"""
    display: Optional[bool] = None
    load: Optional[bool] = None
    labels: Optional[Dict[str, str]] = None


class TabMeta(BaseModel):
    """Metadata about a tab"""
    owner: str
    description: str


class PredefinedQuestion(BaseModel):
    """Configuration for a predefined chat question"""
    id: str
    title: str
    question: str
    category: str
    icon: Optional[str] = None


class TabConfig(BaseModel):
    """Configuration for a single tab"""
    id: str
    display: bool = True
    load: bool = True
    labels: TabLabels
    children: Optional[List[PowerBIReportChild]] = None
    predefinedQuestions: Optional[List[PredefinedQuestion]] = None
    overrides: Optional[Dict[str, TabOverride]] = None
    meta: Optional[TabMeta] = None


class UIConfig(BaseModel):
    """Root UI configuration"""
    version: str
    defaultEnvironment: str = "prod"
    environments: Dict[str, Dict[str, Any]] = Field(default_factory=dict)
    tabs: List[TabConfig]


class UIConfigManager:
    """Manages UI configuration with environment-specific overrides"""
    
    def __init__(self, config_path: Optional[Path] = None, environment: Optional[str] = None):
        """
        Initialize the UI configuration manager
        
        Args:
            config_path: Path to ui-config.json (defaults to backend/ui-config.json)
            environment: Environment name (dev, staging, prod). If None, uses defaultEnvironment from config
        """
        self.config_path = config_path or (BASE_DIR / "ui-config.json")
        self._raw_config: Optional[UIConfig] = None
        self._environment: Optional[str] = environment
        self._load_config()
    
    def _load_config(self) -> None:
        """Load the UI configuration from JSON file"""
        try:
            with open(self.config_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                self._raw_config = UIConfig(**data)
                
            # Set environment to default if not specified
            if self._environment is None:
                self._environment = self._raw_config.defaultEnvironment
                
            print(f"✓ UI Configuration loaded: version={self._raw_config.version}, environment={self._environment}")
            
        except FileNotFoundError:
            print(f"⚠ UI configuration file not found: {self.config_path}")
            # Create default configuration
            self._raw_config = UIConfig(
                version="1.0.0",
                defaultEnvironment="prod",
                environments={},
                tabs=[]
            )
        except Exception as e:
            print(f"⚠ Error loading UI configuration: {e}")
            self._raw_config = UIConfig(
                version="1.0.0",
                defaultEnvironment="prod",
                environments={},
                tabs=[]
            )
    
    def _apply_overrides(self, tab: TabConfig) -> TabConfig:
        """
        Apply environment-specific overrides to a tab configuration
        
        Args:
            tab: Original tab configuration
            
        Returns:
            Tab configuration with overrides applied
        """
        if not tab.overrides or self._environment not in tab.overrides:
            return tab
        
        # Create a copy of the tab
        tab_dict = tab.model_dump()
        override = tab.overrides[self._environment]
        
        # Apply overrides
        if override.display is not None:
            tab_dict['display'] = override.display
        if override.load is not None:
            tab_dict['load'] = override.load
        if override.labels:
            # Merge labels (override only specified fields)
            for key, value in override.labels.items():
                if key in tab_dict['labels']:
                    tab_dict['labels'][key] = value
        
        return TabConfig(**tab_dict)
    
    def get_tab_config(self, tab_id: str) -> Optional[TabConfig]:
        """
        Get configuration for a specific tab with environment overrides applied
        
        Args:
            tab_id: Tab identifier
            
        Returns:
            Tab configuration or None if not found
        """
        if not self._raw_config:
            return None
        
        for tab in self._raw_config.tabs:
            if tab.id == tab_id:
                return self._apply_overrides(tab)
        
        return None
    
    def get_all_tabs(self) -> List[TabConfig]:
        """
        Get all tab configurations with environment overrides applied
        
        Returns:
            List of tab configurations
        """
        if not self._raw_config:
            return []
        
        return [self._apply_overrides(tab) for tab in self._raw_config.tabs]
    
    def get_visible_tabs(self) -> List[TabConfig]:
        """
        Get all tabs that should be displayed in the UI
        
        Returns:
            List of visible tab configurations
        """
        return [tab for tab in self.get_all_tabs() if tab.display]
    
    def get_loadable_tabs(self) -> List[TabConfig]:
        """
        Get all tabs that should have their backend services loaded
        
        Returns:
            List of loadable tab configurations
        """
        return [tab for tab in self.get_all_tabs() if tab.load]
    
    def should_load_service(self, tab_id: str) -> bool:
        """
        Check if a service should be loaded for a specific tab
        
        Args:
            tab_id: Tab identifier
            
        Returns:
            True if service should be loaded, False otherwise
        """
        tab = self.get_tab_config(tab_id)
        return tab.load if tab else False
    
    def should_display_tab(self, tab_id: str) -> bool:
        """
        Check if a tab should be displayed in the UI
        
        Args:
            tab_id: Tab identifier
            
        Returns:
            True if tab should be displayed, False otherwise
        """
        tab = self.get_tab_config(tab_id)
        return tab.display if tab else False
    
    def get_api_response(self) -> Dict[str, Any]:
        """
        Get configuration formatted for API response
        
        Returns:
            Dictionary suitable for JSON API response
        """
        tabs_data = []
        for tab in self.get_all_tabs():
            tab_dict = {
                "id": tab.id,
                "display": tab.display,
                "load": tab.load,
                "labels": {
                    "name": tab.labels.name,
                    "title": tab.labels.title,
                    "subtitle": tab.labels.subtitle
                }
            }
            
            # Include children if present (for Power BI Reports)
            if tab.children:
                tab_dict["children"] = [
                    {
                        "id": child.id,
                        "reportId": child.reportId,
                        "workspaceId": child.workspaceId,
                        "labels": {
                            "name": child.labels.name,
                            "title": child.labels.title,
                            "subtitle": child.labels.subtitle
                        }
                    }
                    for child in tab.children
                ]
            
            # Include predefined questions if present (for chat tabs)
            if tab.predefinedQuestions:
                tab_dict["predefinedQuestions"] = [
                    {
                        "id": question.id,
                        "title": question.title,
                        "question": question.question,
                        "category": question.category,
                        "icon": question.icon
                    }
                    for question in tab.predefinedQuestions
                ]
            
            tabs_data.append(tab_dict)
        
        return {
            "version": self._raw_config.version if self._raw_config else "1.0.0",
            "environment": self._environment,
            "tabs": tabs_data
        }
    
    @property
    def environment(self) -> str:
        """Get current environment"""
        return self._environment or "prod"
    
    @property
    def version(self) -> str:
        """Get configuration version"""
        return self._raw_config.version if self._raw_config else "1.0.0"


# Singleton instance
_ui_config_manager: Optional[UIConfigManager] = None


def get_ui_config_manager(environment: Optional[str] = None) -> UIConfigManager:
    """
    Get or create the UI configuration manager singleton
    
    Args:
        environment: Environment name (dev, staging, prod)
        
    Returns:
        UIConfigManager instance
    """
    global _ui_config_manager
    if _ui_config_manager is None:
        _ui_config_manager = UIConfigManager(environment=environment)
    return _ui_config_manager
