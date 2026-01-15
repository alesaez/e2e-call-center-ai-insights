# Role-Based Access Control (RBAC) Setup Guide

## Overview

This application implements a comprehensive RBAC system similar to Azure's, supporting:
- **Built-in App Roles** (Administrator, Contributor, Reader)
- **Custom Roles** with granular permissions
- **Dynamic role management** through UI (future)
- **Permission-based access control** for all features

---

## Step 1: Configure App Roles in Azure Entra ID

### 1.1 Open Your App Registration

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Microsoft Entra ID** → **App registrations**
3. Select your **backend API** app registration
4. Click **App roles** in the left menu
5. Click **Create app role**

### 1.2 Add Built-in Roles

Create these three built-in roles:

#### **Administrator Role**

```
Display name: Administrator
Allowed member types: Users/Groups
Value: Administrator
Description: Full access to all features including user and role management
Do you want to enable this app role?: Yes
```

#### **Contributor Role**

```
Display name: Contributor
Allowed member types: Users/Groups
Value: Contributor
Description: Create, read, and update resources but cannot manage users or roles
Do you want to enable this app role?: Yes
```

#### **Reader Role**

```
Display name: Reader
Allowed member types: Users/Groups
Value: Reader
Description: Read-only access to all features
Do you want to enable this app role?: Yes
```

### 1.3 Assign Roles to Users

1. Go to **Enterprise applications** in Azure Portal
2. Find your application
3. Click **Users and groups**
4. Click **Add user/group**
5. Select user and assign role
6. Click **Assign**

---

## Step 2: Built-in Role Permissions

### Administrator
- ✅ **All permissions** (full access)
- ✅ Manage users and role assignments
- ✅ Create, update, delete custom roles
- ✅ View audit logs
- ✅ Manage system configuration

### Contributor
- ✅ View dashboards and export data
- ✅ Create and manage chat conversations
- ✅ View, export, and refresh Power BI reports
- ✅ Create, update, delete query templates
- ✅ Query AI Foundry with advanced features
- ❌ Cannot manage users or roles
- ❌ Cannot modify system configuration

### Reader
- ✅ View dashboards (read-only)
- ✅ View chat conversations (read-only)
- ✅ View Power BI reports (read-only)
- ✅ View query templates (read-only)
- ✅ Query AI Foundry (basic queries)
- ✅ View audit logs
- ❌ Cannot create, update, or delete resources
- ❌ Cannot export or modify data

---

## Step 3: Granular Permissions

The system uses granular permissions that can be combined into custom roles:

### Dashboard Permissions
- `dashboard:view` - View dashboard
- `dashboard:export` - Export dashboard data

### Chat Permissions
- `chat:view` - View chat conversations
- `chat:create` - Create new conversations
- `chat:delete` - Delete conversations

### Power BI Permissions
- `powerbi:view` - View Power BI reports
- `powerbi:export` - Export reports as PDF
- `powerbi:refresh` - Refresh report data

### Query Template Permissions
- `templates:view` - View query templates
- `templates:create` - Create new templates
- `templates:update` - Update existing templates
- `templates:delete` - Delete templates

### AI Foundry Permissions
- `ai_foundry:query` - Run basic AI queries
- `ai_foundry:advanced` - Use advanced AI features

### Administration Permissions
- `admin:users:view` - View users
- `admin:users:manage` - Manage users
- `admin:roles:view` - View roles
- `admin:roles:manage` - Create/update/delete roles
- `admin:audit:view` - View audit logs
- `admin:config:view` - View system configuration
- `admin:config:manage` - Manage system configuration

---

## Step 4: Create Custom Roles (API)

### Example: Create "Analyst" Role

```bash
POST /api/rbac/roles
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "name": "Analyst",
  "description": "Data analysts can view and export data but not modify it",
  "permissions": [
    "dashboard:view",
    "dashboard:export",
    "chat:view",
    "powerbi:view",
    "powerbi:export",
    "templates:view",
    "ai_foundry:query",
    "ai_foundry:advanced"
  ]
}
```

### Example: Create "Support Agent" Role

```bash
POST /api/rbac/roles
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "name": "Support Agent",
  "description": "Support agents can manage conversations but not access analytics",
  "permissions": [
    "chat:view",
    "chat:create",
    "chat:delete",
    "templates:view",
    "ai_foundry:query"
  ]
}
```

---

## Step 5: Using RBAC in Code

### Backend (Python/FastAPI)

#### Require Specific Permission

```python
from rbac_models import Permission
from main import require_permission, UserPermissions

@app.get("/api/reports")
async def get_reports(
    user_permissions: UserPermissions = Depends(require_permission(Permission.DASHBOARD_VIEW))
):
    """Only users with dashboard:view permission can access."""
    return {"reports": [...]}
```

#### Require Any of Multiple Permissions

```python
from main import require_any_permission

@app.post("/api/data/export")
async def export_data(
    user_permissions: UserPermissions = Depends(require_any_permission([
        Permission.DASHBOARD_EXPORT,
        Permission.POWERBI_EXPORT
    ]))
):
    """Users need either export permission."""
    return {"data": [...]}
```

#### Require Administrator

```python
from main import require_admin

@app.delete("/api/admin/users/{user_id}")
async def delete_user(
    user_id: str,
    user_permissions: UserPermissions = Depends(require_admin())
):
    """Only administrators can delete users."""
    return {"status": "deleted"}
```

#### Check Permissions Programmatically

```python
@app.get("/api/data")
async def get_data(user_permissions: UserPermissions = Depends(get_user_permissions)):
    """Custom permission logic."""
    
    # Check single permission
    if rbac_service.has_permission(user_permissions, Permission.DASHBOARD_VIEW):
        # Return full data
        return {"data": [...]}
    
    # Check if admin
    if user_permissions.is_administrator:
        # Return admin data
        return {"data": [...], "admin": True}
    
    # Return limited data
    return {"data": []}
```

### Frontend (React/TypeScript)

#### Check User Permissions

```typescript
// services/rbacService.ts
import apiClient from './apiClient';

export interface UserPermissions {
  user_id: string;
  user_email: string;
  roles: string[];
  permissions: string[];
  is_administrator: boolean;
}

export const getUserPermissions = async (): Promise<UserPermissions> => {
  const response = await apiClient.get('/api/rbac/permissions');
  return response.data;
};

export const hasPermission = (
  permissions: UserPermissions,
  requiredPermission: string
): boolean => {
  return permissions.permissions.includes(requiredPermission) || 
         permissions.is_administrator;
};
```

#### Conditional UI Rendering

```tsx
import { useState, useEffect } from 'react';
import { getUserPermissions, hasPermission } from './services/rbacService';

function Dashboard() {
  const [permissions, setPermissions] = useState(null);
  
  useEffect(() => {
    getUserPermissions().then(setPermissions);
  }, []);
  
  if (!permissions) return <Loading />;
  
  return (
    <div>
      {/* Always visible */}
      <h1>Dashboard</h1>
      
      {/* Only for users with export permission */}
      {hasPermission(permissions, 'dashboard:export') && (
        <Button onClick={handleExport}>Export Data</Button>
      )}
      
      {/* Only for administrators */}
      {permissions.is_administrator && (
        <AdminPanel />
      )}
    </div>
  );
}
```

---

## Step 6: Testing RBAC

### 1. Test Built-in Roles

```bash
# Get your permissions
curl -H "Authorization: Bearer <token>" \
  http://localhost:8000/api/rbac/permissions

# Expected response:
{
  "user_id": "abc123...",
  "user_email": "user@example.com",
  "roles": ["Administrator"],
  "permissions": ["dashboard:view", "dashboard:export", ...],
  "is_administrator": true
}
```

### 2. Test Permission Enforcement

```bash
# As Reader - should succeed
curl -H "Authorization: Bearer <reader-token>" \
  http://localhost:8000/api/dashboard/kpis

# As Reader - should fail (403 Forbidden)
curl -X POST -H "Authorization: Bearer <reader-token>" \
  http://localhost:8000/api/chat/conversations
```

### 3. Test Custom Role Management

```bash
# List all roles (requires admin)
curl -H "Authorization: Bearer <admin-token>" \
  http://localhost:8000/api/rbac/roles

# Create custom role (requires admin)
curl -X POST -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Analyst", "description": "...", "permissions": [...]}' \
  http://localhost:8000/api/rbac/roles

# Update custom role (requires admin)
curl -X PUT -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"permissions": [...]}' \
  http://localhost:8000/api/rbac/roles/custom_abc123

# Delete custom role (requires admin)
curl -X DELETE -H "Authorization: Bearer <admin-token>" \
  http://localhost:8000/api/rbac/roles/custom_abc123
```

---

## Step 7: Future UI for Role Management

The system is designed to support a future admin UI for managing roles:

### Admin Dashboard (Future)
- View all roles (built-in and custom)
- Create new custom roles with permission picker
- Edit custom roles
- Enable/disable roles
- View role assignments per user
- Assign roles to users
- View audit log of role changes

### Role Creation UI (Future)
```
┌─────────────────────────────────────────┐
│ Create Custom Role                      │
├─────────────────────────────────────────┤
│ Name: [___________________________]     │
│                                         │
│ Description:                            │
│ [_________________________________]     │
│ [_________________________________]     │
│                                         │
│ Permissions:                            │
│ ☐ Dashboard                             │
│   ☑ dashboard:view                      │
│   ☑ dashboard:export                    │
│ ☐ Chat                                  │
│   ☑ chat:view                           │
│   ☐ chat:create                         │
│   ☐ chat:delete                         │
│ ☐ Power BI                              │
│   ☑ powerbi:view                        │
│   ☑ powerbi:export                      │
│   ☐ powerbi:refresh                     │
│                                         │
│ [Cancel]  [Create Role]                 │
└─────────────────────────────────────────┘
```

---

## Step 8: Security Best Practices

### ✅ Do's
1. **Always check permissions** in both frontend (UI) and backend (API)
2. **Use least privilege** - assign minimum permissions needed
3. **Audit role changes** - log all role assignments and modifications
4. **Review permissions regularly** - ensure roles still match needs
5. **Test with different roles** - verify permission enforcement works
6. **Use built-in roles** for standard access patterns
7. **Create custom roles** for specialized needs

### ❌ Don'ts
1. **Don't rely only on frontend checks** - always enforce in backend
2. **Don't hardcode user IDs** - use role-based access
3. **Don't give everyone Administrator** - use appropriate roles
4. **Don't modify built-in roles** - create custom roles instead
5. **Don't skip role assignment** - users need at least one role
6. **Don't expose internal IDs** - use role names in UI

---

## Step 9: Migration Path

If you have existing users without roles:

### Option 1: Assign Default Role
```python
# In startup script
for user in existing_users:
    assign_role(user.id, "Contributor")  # Default role
```

### Option 2: Graceful Degradation
```python
# In permission check
if not user.roles:
    # Treat as Reader by default
    return BUILT_IN_ROLES["Reader"].permissions
```

---

## API Reference

### Get My Permissions
```
GET /api/rbac/permissions
Authorization: Bearer <token>
Response: UserPermissions
```

### List All Roles
```
GET /api/rbac/roles?include_disabled=false
Authorization: Bearer <admin-token>
Response: RoleDefinition[]
```

### Create Custom Role
```
POST /api/rbac/roles
Authorization: Bearer <admin-token>
Body: CreateRoleRequest
Response: RoleDefinition (201 Created)
```

### Update Custom Role
```
PUT /api/rbac/roles/{role_id}
Authorization: Bearer <admin-token>
Body: UpdateRoleRequest
Response: RoleDefinition
```

### Delete Custom Role
```
DELETE /api/rbac/roles/{role_id}
Authorization: Bearer <admin-token>
Response: 204 No Content
```

### List Available Permissions
```
GET /api/rbac/permissions/available
Authorization: Bearer <admin-token>
Response: {value: string, name: string}[]
```

---

## Troubleshooting

### Users don't have roles in token
**Solution:** Ensure:
1. App Roles are defined in App Registration
2. Users are assigned roles in Enterprise Applications
3. Token includes `roles` claim (check at jwt.ms)
4. User has signed out and back in after role assignment

### Permission denied errors
**Solution:**
1. Check user's permissions: `GET /api/rbac/permissions`
2. Verify required permission in endpoint
3. Ensure role includes needed permission
4. Check if role is enabled

### Custom roles not persisting
**Solution:**
1. Verify Cosmos DB is configured
2. Check container names in RBAC service
3. Review Cosmos DB connection logs
4. Ensure proper permissions on Cosmos DB

---

## Summary

✅ **Implemented:**
- Built-in roles (Administrator, Contributor, Reader)
- Granular permissions system
- Custom role CRUD operations
- Permission-based endpoint protection
- Token-based role extraction
- Future-ready for UI management

✅ **Next Steps:**
1. Add App Roles to Azure Entra ID
2. Assign roles to users
3. Test with different roles
4. Build admin UI for role management (future)
5. Add audit logging for role changes (future)

This RBAC system provides enterprise-grade access control similar to Azure's, with the flexibility to grow as your application's needs evolve! 🔒
