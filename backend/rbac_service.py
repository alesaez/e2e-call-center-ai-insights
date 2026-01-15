"""
Role-Based Access Control (RBAC) Service.
Manages roles, permissions, and role assignments with support for custom roles.
"""
from typing import List, Optional, Dict, Set
from datetime import datetime
import uuid
import logging
from fastapi import HTTPException, status

from rbac_models import (
    RoleDefinition,
    RoleAssignment,
    UserPermissions,
    Permission,
    BuiltInRole,
    BUILT_IN_ROLES,
    CreateRoleRequest,
    UpdateRoleRequest,
    AssignRoleRequest
)
from cosmos_service import CosmosDBService

logger = logging.getLogger(__name__)


class RBACService:
    """
    Service for managing role-based access control.
    Stores custom roles and role assignments in Cosmos DB.
    """
    
    def __init__(self, cosmos_service: Optional[CosmosDBService] = None):
        """
        Initialize RBAC service.
        
        Args:
            cosmos_service: Optional Cosmos DB service for persisting custom roles
        """
        self.cosmos_service = cosmos_service
        self.custom_roles_container = "custom_roles" if cosmos_service else None
        self.role_assignments_container = "role_assignments" if cosmos_service else None
        
        # In-memory cache for custom roles (if Cosmos DB not available)
        self._custom_roles_cache: Dict[str, RoleDefinition] = {}
        self._role_assignments_cache: Dict[str, List[RoleAssignment]] = {}
    
    def extract_roles_from_token(self, token_payload: Dict) -> List[str]:
        """
        Extract roles from JWT token payload.
        Supports both 'roles' claim (App Roles) and 'scp' claim (scopes).
        
        Args:
            token_payload: Decoded JWT token payload
            
        Returns:
            List of role names
        """
        roles = []
        
        # Check for App Roles (roles claim)
        if "roles" in token_payload:
            roles.extend(token_payload["roles"])
        
        # Check for scopes (scp claim) - some tokens use this
        if "scp" in token_payload:
            scopes = token_payload["scp"].split() if isinstance(token_payload["scp"], str) else token_payload["scp"]
            roles.extend(scopes)
        
        return roles
    
    async def get_user_permissions(self, token_payload: Dict) -> UserPermissions:
        """
        Get aggregated permissions for a user based on their roles.
        
        Args:
            token_payload: Decoded JWT token payload
            
        Returns:
            UserPermissions object with aggregated permissions
        """
        user_id = token_payload.get("oid", "")
        user_email = token_payload.get("preferred_username") or token_payload.get("email", "")
        
        # Extract roles from token
        token_roles = self.extract_roles_from_token(token_payload)
        
        # Get additional role assignments from database
        db_assignments = await self._get_user_role_assignments(user_id)
        db_roles = [assignment.role_name for assignment in db_assignments]
        
        # Combine all roles
        all_roles = list(set(token_roles + db_roles))
        
        # Aggregate permissions from all roles
        permissions: Set[Permission] = set()
        
        for role_name in all_roles:
            role_def = await self.get_role_definition(role_name)
            if role_def and role_def.is_enabled:
                permissions.update(role_def.permissions)
        
        is_admin = BuiltInRole.ADMINISTRATOR.value in all_roles
        
        return UserPermissions(
            user_id=user_id,
            user_email=user_email,
            roles=all_roles,
            permissions=list(permissions),
            is_administrator=is_admin
        )
    
    async def get_role_definition(self, role_name: str) -> Optional[RoleDefinition]:
        """
        Get role definition by name.
        Checks built-in roles first, then custom roles.
        
        Args:
            role_name: Name of the role
            
        Returns:
            RoleDefinition or None if not found
        """
        # Check built-in roles first
        if role_name in BUILT_IN_ROLES:
            return BUILT_IN_ROLES[role_name]
        
        # Check custom roles
        if self.cosmos_service and self.custom_roles_container:
            try:
                # Query Cosmos DB for custom role
                query = f"SELECT * FROM c WHERE c.name = '{role_name}'"
                roles = await self.cosmos_service.query_items(self.custom_roles_container, query)
                if roles:
                    return RoleDefinition(**roles[0])
            except Exception as e:
                logger.error(f"Error fetching custom role {role_name}: {e}")
        
        # Check in-memory cache
        return self._custom_roles_cache.get(role_name)
    
    async def list_all_roles(self, include_disabled: bool = False) -> List[RoleDefinition]:
        """
        List all available roles (built-in and custom).
        
        Args:
            include_disabled: Whether to include disabled roles
            
        Returns:
            List of RoleDefinition objects
        """
        roles: List[RoleDefinition] = []
        
        # Add built-in roles
        for role in BUILT_IN_ROLES.values():
            if include_disabled or role.is_enabled:
                roles.append(role)
        
        # Add custom roles from Cosmos DB
        if self.cosmos_service and self.custom_roles_container:
            try:
                query = "SELECT * FROM c WHERE c.is_built_in = false"
                if not include_disabled:
                    query += " AND c.is_enabled = true"
                
                custom_roles = await self.cosmos_service.query_items(self.custom_roles_container, query)
                roles.extend([RoleDefinition(**role) for role in custom_roles])
            except Exception as e:
                logger.error(f"Error fetching custom roles: {e}")
        
        # Add custom roles from cache
        for role in self._custom_roles_cache.values():
            if include_disabled or role.is_enabled:
                if role not in roles:
                    roles.append(role)
        
        return roles
    
    async def create_custom_role(
        self,
        request: CreateRoleRequest,
        created_by: str
    ) -> RoleDefinition:
        """
        Create a new custom role.
        
        Args:
            request: CreateRoleRequest with role details
            created_by: User ID of the creator
            
        Returns:
            Created RoleDefinition
        """
        # Validate role name doesn't conflict with built-in roles
        if request.name in BUILT_IN_ROLES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot create custom role with built-in role name: {request.name}"
            )
        
        # Check if role already exists
        existing_role = await self.get_role_definition(request.name)
        if existing_role:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Role with name '{request.name}' already exists"
            )
        
        # Create role definition
        role_id = f"custom_{uuid.uuid4().hex[:8]}"
        now = datetime.utcnow()
        
        role = RoleDefinition(
            id=role_id,
            name=request.name,
            description=request.description,
            permissions=request.permissions,
            is_built_in=False,
            is_enabled=True,
            created_at=now,
            updated_at=now,
            created_by=created_by
        )
        
        # Save to Cosmos DB or cache
        if self.cosmos_service and self.custom_roles_container:
            try:
                await self.cosmos_service.create_item(
                    self.custom_roles_container,
                    role.model_dump()
                )
            except Exception as e:
                logger.error(f"Error creating custom role in Cosmos DB: {e}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to create custom role"
                )
        else:
            self._custom_roles_cache[role.name] = role
        
        logger.info(f"Created custom role: {role.name} by user: {created_by}")
        return role
    
    async def update_custom_role(
        self,
        role_id: str,
        request: UpdateRoleRequest,
        updated_by: str
    ) -> RoleDefinition:
        """
        Update a custom role.
        Built-in roles cannot be updated.
        
        Args:
            role_id: Role identifier
            request: UpdateRoleRequest with changes
            updated_by: User ID of the updater
            
        Returns:
            Updated RoleDefinition
        """
        # Get existing role
        roles = await self.list_all_roles(include_disabled=True)
        role = next((r for r in roles if r.id == role_id), None)
        
        if not role:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Role with ID '{role_id}' not found"
            )
        
        if role.is_built_in:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot modify built-in roles"
            )
        
        # Update fields
        if request.name is not None:
            role.name = request.name
        if request.description is not None:
            role.description = request.description
        if request.permissions is not None:
            role.permissions = request.permissions
        if request.is_enabled is not None:
            role.is_enabled = request.is_enabled
        
        role.updated_at = datetime.utcnow()
        
        # Save to Cosmos DB or cache
        if self.cosmos_service and self.custom_roles_container:
            try:
                await self.cosmos_service.upsert_item(
                    self.custom_roles_container,
                    role.model_dump()
                )
            except Exception as e:
                logger.error(f"Error updating custom role in Cosmos DB: {e}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to update custom role"
                )
        else:
            self._custom_roles_cache[role.name] = role
        
        logger.info(f"Updated custom role: {role.name} by user: {updated_by}")
        return role
    
    async def delete_custom_role(self, role_id: str, deleted_by: str) -> bool:
        """
        Delete a custom role.
        Built-in roles cannot be deleted.
        
        Args:
            role_id: Role identifier
            deleted_by: User ID of the deleter
            
        Returns:
            True if deleted successfully
        """
        # Get existing role
        roles = await self.list_all_roles(include_disabled=True)
        role = next((r for r in roles if r.id == role_id), None)
        
        if not role:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Role with ID '{role_id}' not found"
            )
        
        if role.is_built_in:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot delete built-in roles"
            )
        
        # Delete from Cosmos DB or cache
        if self.cosmos_service and self.custom_roles_container:
            try:
                await self.cosmos_service.delete_item(
                    self.custom_roles_container,
                    role_id,
                    partition_key=role_id
                )
            except Exception as e:
                logger.error(f"Error deleting custom role from Cosmos DB: {e}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to delete custom role"
                )
        else:
            self._custom_roles_cache.pop(role.name, None)
        
        logger.info(f"Deleted custom role: {role.name} by user: {deleted_by}")
        return True
    
    async def _get_user_role_assignments(self, user_id: str) -> List[RoleAssignment]:
        """Get all role assignments for a user."""
        if self.cosmos_service and self.role_assignments_container:
            try:
                query = f"SELECT * FROM c WHERE c.user_id = '{user_id}'"
                assignments = await self.cosmos_service.query_items(
                    self.role_assignments_container,
                    query
                )
                return [RoleAssignment(**assignment) for assignment in assignments]
            except Exception as e:
                logger.error(f"Error fetching role assignments: {e}")
        
        return self._role_assignments_cache.get(user_id, [])
    
    def has_permission(self, user_permissions: UserPermissions, required_permission: Permission) -> bool:
        """
        Check if user has a specific permission.
        
        Args:
            user_permissions: UserPermissions object
            required_permission: Permission to check
            
        Returns:
            True if user has the permission
        """
        return required_permission in user_permissions.permissions or user_permissions.is_administrator
    
    def has_any_permission(
        self,
        user_permissions: UserPermissions,
        required_permissions: List[Permission]
    ) -> bool:
        """Check if user has any of the specified permissions."""
        return any(self.has_permission(user_permissions, perm) for perm in required_permissions)
    
    def has_all_permissions(
        self,
        user_permissions: UserPermissions,
        required_permissions: List[Permission]
    ) -> bool:
        """Check if user has all of the specified permissions."""
        return all(self.has_permission(user_permissions, perm) for perm in required_permissions)
