"""
Role-Based Access Control (RBAC) models.
Supports both Azure App Roles and custom role definitions.
"""
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from enum import Enum
from datetime import datetime


class Permission(str, Enum):
    """Granular permissions that can be assigned to roles."""
    # Dashboard permissions
    DASHBOARD_VIEW = "dashboard:view"
    DASHBOARD_EXPORT = "dashboard:export"
    
    # Chat permissions
    CHAT_VIEW = "chat:view"
    CHAT_CREATE = "chat:create"
    CHAT_DELETE = "chat:delete"
    
    # Power BI permissions
    POWERBI_VIEW = "powerbi:view"
    POWERBI_EXPORT = "powerbi:export"
    POWERBI_REFRESH = "powerbi:refresh"
    
    # Query template permissions
    TEMPLATES_VIEW = "templates:view"
    TEMPLATES_CREATE = "templates:create"
    TEMPLATES_UPDATE = "templates:update"
    TEMPLATES_DELETE = "templates:delete"
    
    # AI Foundry permissions
    AI_FOUNDRY_QUERY = "ai_foundry:query"
    AI_FOUNDRY_ADVANCED = "ai_foundry:advanced"
    
    # Administration permissions
    ADMIN_USERS_VIEW = "admin:users:view"
    ADMIN_USERS_MANAGE = "admin:users:manage"
    ADMIN_ROLES_VIEW = "admin:roles:view"
    ADMIN_ROLES_MANAGE = "admin:roles:manage"
    ADMIN_AUDIT_VIEW = "admin:audit:view"
    ADMIN_CONFIG_VIEW = "admin:config:view"
    ADMIN_CONFIG_MANAGE = "admin:config:manage"


class BuiltInRole(str, Enum):
    """Built-in roles that map to Azure App Roles."""
    ADMINISTRATOR = "Administrator"
    CONTRIBUTOR = "Contributor"
    READER = "Reader"


class RoleDefinition(BaseModel):
    """
    Role definition with permissions.
    Can be a built-in role or a custom role.
    """
    id: str = Field(..., description="Unique role identifier")
    name: str = Field(..., description="Display name of the role")
    description: str = Field(..., description="Role description")
    permissions: List[Permission] = Field(default_factory=list, description="List of permissions")
    is_built_in: bool = Field(default=False, description="Whether this is a built-in role")
    is_enabled: bool = Field(default=True, description="Whether this role is active")
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    created_by: Optional[str] = None


class RoleAssignment(BaseModel):
    """
    Assignment of a role to a user.
    """
    id: str = Field(..., description="Unique assignment identifier")
    user_id: str = Field(..., description="Azure AD object ID of the user")
    user_email: str = Field(..., description="Email of the user")
    role_id: str = Field(..., description="Role identifier")
    role_name: str = Field(..., description="Role display name")
    assigned_at: datetime = Field(default_factory=datetime.utcnow)
    assigned_by: str = Field(..., description="Who assigned this role")
    scope: Optional[str] = Field(default=None, description="Optional scope limitation (e.g., specific workspace)")


class UserPermissions(BaseModel):
    """
    Computed permissions for a user based on their roles.
    """
    user_id: str
    user_email: str
    roles: List[str] = Field(default_factory=list, description="Role names")
    permissions: List[Permission] = Field(default_factory=list, description="Aggregated permissions")
    is_administrator: bool = False


# Built-in role definitions
BUILT_IN_ROLES: Dict[str, RoleDefinition] = {
    BuiltInRole.ADMINISTRATOR.value: RoleDefinition(
        id="builtin_administrator",
        name="Administrator",
        description="Full access to all features including user and role management",
        permissions=[permission for permission in Permission],  # All permissions
        is_built_in=True,
        is_enabled=True
    ),
    BuiltInRole.CONTRIBUTOR.value: RoleDefinition(
        id="builtin_contributor",
        name="Contributor",
        description="Create, read, and update resources but cannot manage users or roles",
        permissions=[
            Permission.DASHBOARD_VIEW,
            Permission.DASHBOARD_EXPORT,
            Permission.CHAT_VIEW,
            Permission.CHAT_CREATE,
            Permission.CHAT_DELETE,
            Permission.POWERBI_VIEW,
            Permission.POWERBI_EXPORT,
            Permission.POWERBI_REFRESH,
            Permission.TEMPLATES_VIEW,
            Permission.TEMPLATES_CREATE,
            Permission.TEMPLATES_UPDATE,
            Permission.TEMPLATES_DELETE,
            Permission.AI_FOUNDRY_QUERY,
            Permission.AI_FOUNDRY_ADVANCED,
        ],
        is_built_in=True,
        is_enabled=True
    ),
    BuiltInRole.READER.value: RoleDefinition(
        id="builtin_reader",
        name="Reader",
        description="Read-only access to all features",
        permissions=[
            Permission.DASHBOARD_VIEW,
            Permission.CHAT_VIEW,
            Permission.CHAT_CREATE,
            Permission.CHAT_DELETE,
            Permission.POWERBI_VIEW,
            Permission.TEMPLATES_VIEW,
            Permission.AI_FOUNDRY_QUERY,
            Permission.ADMIN_AUDIT_VIEW,
            Permission.ADMIN_CONFIG_VIEW,
        ],
        is_built_in=True,
        is_enabled=True
    ),
}


class CreateRoleRequest(BaseModel):
    """Request to create a custom role."""
    name: str = Field(..., min_length=3, max_length=50)
    description: str = Field(..., min_length=10, max_length=200)
    permissions: List[Permission]


class UpdateRoleRequest(BaseModel):
    """Request to update a custom role."""
    name: Optional[str] = Field(None, min_length=3, max_length=50)
    description: Optional[str] = Field(None, min_length=10, max_length=200)
    permissions: Optional[List[Permission]] = None
    is_enabled: Optional[bool] = None


class AssignRoleRequest(BaseModel):
    """Request to assign a role to a user."""
    user_email: str = Field(..., description="Email of the user to assign role to")
    role_id: str = Field(..., description="Role identifier")
    scope: Optional[str] = None
