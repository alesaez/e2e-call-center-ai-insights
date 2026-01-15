# Quick Reference: Adding New Protected Endpoints

This guide shows how to add new endpoints with RBAC protection to the Call Center AI Insights API.

## Step 1: Choose the Right Permission

First, determine which permission(s) your endpoint requires. Available permissions are defined in `backend/rbac_models.py`:

### Dashboard Permissions
- `DASHBOARD_VIEW` - View dashboard data
- `DASHBOARD_EXPORT` - Export dashboard data

### Chat Permissions
- `CHAT_VIEW` - View conversations
- `CHAT_CREATE` - Create conversations/messages
- `CHAT_DELETE` - Delete conversations

### Power BI Permissions
- `POWERBI_VIEW` - View Power BI reports
- `POWERBI_EXPORT` - Export reports as PDF
- `POWERBI_REFRESH` - Refresh report data

### Template Permissions
- `TEMPLATES_VIEW` - View templates
- `TEMPLATES_CREATE` - Create templates
- `TEMPLATES_UPDATE` - Update templates
- `TEMPLATES_DELETE` - Delete templates

### AI Foundry Permissions
- `AI_FOUNDRY_QUERY` - Run basic queries
- `AI_FOUNDRY_ADVANCED` - Use advanced features

### Admin Permissions
- `ADMIN_USERS_VIEW` - View users
- `ADMIN_USERS_MANAGE` - Manage users
- `ADMIN_ROLES_VIEW` - View roles
- `ADMIN_ROLES_MANAGE` - Manage roles
- `ADMIN_AUDIT_VIEW` - View audit logs
- `ADMIN_CONFIG_VIEW` - View configuration
- `ADMIN_CONFIG_MANAGE` - Manage configuration

---

## Step 2: Import Required Types

At the top of `main.py`, ensure you have:

```python
from rbac_models import (
    Permission,
    UserPermissions,
    RoleDefinition,
    CreateRoleRequest,
    UpdateRoleRequest
)
```

---

## Step 3: Choose Protection Pattern

### Pattern A: Require Specific Permission

Use this when the endpoint requires ONE specific permission:

```python
from rbac_models import Permission

@app.get("/api/my-endpoint")
async def my_endpoint(
    user_permissions: UserPermissions = Depends(require_permission(Permission.DASHBOARD_VIEW))
):
    """
    Description of what this endpoint does.
    Requires: DASHBOARD_VIEW permission
    """
    # Access user info if needed
    user_id = user_permissions.user_id
    user_email = user_permissions.user_email
    is_admin = user_permissions.is_administrator
    
    # Your endpoint logic here
    return {"data": "..."}
```

### Pattern B: Require Any of Multiple Permissions

Use this when the endpoint accepts ANY of several permissions:

```python
@app.get("/api/my-endpoint")
async def my_endpoint(
    user_permissions: UserPermissions = Depends(require_any_permission([
        Permission.DASHBOARD_EXPORT,
        Permission.POWERBI_EXPORT
    ]))
):
    """
    Description of what this endpoint does.
    Requires: DASHBOARD_EXPORT OR POWERBI_EXPORT permission
    """
    # Your endpoint logic here
    return {"data": "..."}
```

### Pattern C: Require Administrator

Use this for admin-only endpoints:

```python
@app.delete("/api/admin/users/{user_id}")
async def delete_user(
    user_id: str,
    user_permissions: UserPermissions = Depends(require_admin())
):
    """
    Delete a user (admin only).
    Requires: Administrator role
    """
    # Your endpoint logic here
    return {"status": "deleted"}
```

### Pattern D: Check Permissions Programmatically

Use this for complex permission logic:

```python
@app.get("/api/my-endpoint")
async def my_endpoint(
    user_permissions: UserPermissions = Depends(get_user_permissions)
):
    """
    Endpoint with custom permission logic.
    """
    # Check specific permission
    if rbac_service.has_permission(user_permissions, Permission.DASHBOARD_VIEW):
        # Return full data
        return {"data": "full"}
    
    # Check if admin
    if user_permissions.is_administrator:
        # Return admin data
        return {"data": "admin"}
    
    # Return limited data
    return {"data": "limited"}
```

---

## Step 4: Add Rate Limiting (Optional)

For resource-intensive or spam-prone endpoints:

```python
from fastapi import Request

@app.post("/api/my-endpoint")
@limiter.limit("10/minute")  # Customize as needed
async def my_endpoint(
    request: Request,  # Required for rate limiter
    user_permissions: UserPermissions = Depends(require_permission(Permission.DASHBOARD_EXPORT))
):
    """
    Description of what this endpoint does.
    Requires: DASHBOARD_EXPORT permission
    Rate limited to 10 requests per minute.
    """
    # Your endpoint logic here
    return {"data": "..."}
```

**Common Rate Limits:**
- Read operations: 100-200/minute
- Write operations: 30-50/minute
- Chat/AI queries: 30/minute
- Resource-intensive (exports, reports): 10/minute

---

## Step 5: Update Documentation

Always document the permission requirement in:

1. **Docstring**: Include "Requires: <PERMISSION>" line
2. **This file**: Add endpoint to `ENDPOINT-PROTECTION-SUMMARY.md`
3. **API docs**: FastAPI auto-generates docs at `/docs`

---

## Complete Examples

### Example 1: Simple Protected GET Endpoint

```python
@app.get("/api/reports/summary")
async def get_reports_summary(
    user_permissions: UserPermissions = Depends(require_permission(Permission.DASHBOARD_VIEW))
):
    """
    Get summary of all reports.
    Requires: DASHBOARD_VIEW permission
    """
    return {
        "total_reports": 42,
        "recent_reports": [...]
    }
```

### Example 2: Protected POST with Rate Limiting

```python
@app.post("/api/reports/generate")
@limiter.limit("5/minute")
async def generate_report(
    request: Request,
    report_type: str,
    user_permissions: UserPermissions = Depends(require_permission(Permission.DASHBOARD_EXPORT))
):
    """
    Generate a new report.
    Requires: DASHBOARD_EXPORT permission
    Rate limited to 5 reports per minute.
    """
    user_id = user_permissions.user_id
    
    # Generate report logic
    report = await generate_report_service(report_type, user_id)
    
    return {"report_id": report.id, "status": "generating"}
```

### Example 3: Protected DELETE with Ownership Check

```python
@app.delete("/api/reports/{report_id}")
async def delete_report(
    report_id: str,
    user_permissions: UserPermissions = Depends(require_permission(Permission.DASHBOARD_EXPORT))
):
    """
    Delete a report.
    Users can only delete their own reports unless they're admin.
    Requires: DASHBOARD_EXPORT permission
    """
    report = get_report_from_db(report_id)
    
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    # Check ownership (admins bypass this)
    if report.user_id != user_permissions.user_id and not user_permissions.is_administrator:
        raise HTTPException(
            status_code=403,
            detail="You can only delete your own reports"
        )
    
    delete_report_from_db(report_id)
    return {"status": "deleted"}
```

### Example 4: Multiple Permission Check

```python
@app.post("/api/data/sync")
async def sync_data(
    user_permissions: UserPermissions = Depends(get_user_permissions)
):
    """
    Sync data across multiple sources.
    Requires various permissions depending on data sources.
    """
    sync_results = {}
    
    # Sync dashboard data if user has permission
    if rbac_service.has_permission(user_permissions, Permission.DASHBOARD_VIEW):
        sync_results["dashboard"] = await sync_dashboard()
    
    # Sync Power BI data if user has permission
    if rbac_service.has_permission(user_permissions, Permission.POWERBI_VIEW):
        sync_results["powerbi"] = await sync_powerbi()
    
    # Sync chat data if user has permission
    if rbac_service.has_permission(user_permissions, Permission.CHAT_VIEW):
        sync_results["chat"] = await sync_chat()
    
    return {"synced": sync_results}
```

---

## Testing Your Protected Endpoint

### 1. Start the Backend
```bash
cd backend
python main.py
```

### 2. Test Without Token (Should Fail)
```bash
curl http://localhost:8000/api/my-endpoint
# Expected: 401 Unauthorized
```

### 3. Test With Valid Token (Should Succeed/Fail Based on Permission)
```bash
# Get token (login to app and copy from browser DevTools)
TOKEN="eyJ0eXAiOiJKV1QiLCJhbGc..."

# Test as Reader (might succeed or fail depending on permission)
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/my-endpoint

# Check response:
# - 200: Success (user has permission)
# - 403: Forbidden (user lacks permission)
# - 401: Unauthorized (invalid token)
```

### 4. Test Rate Limiting
```bash
# Send requests rapidly
for i in {1..20}; do
  curl -H "Authorization: Bearer $TOKEN" \
    http://localhost:8000/api/my-endpoint
done
# Should see 429 after rate limit exceeded
```

---

## Common Mistakes to Avoid

### ❌ DON'T: Use old token_payload pattern
```python
# WRONG - Old pattern
@app.get("/api/endpoint")
async def endpoint(token_payload: Dict = Depends(verify_token)):
    user_id = token_payload.get("oid")
```

### ✅ DO: Use UserPermissions with RBAC
```python
# CORRECT - New pattern
@app.get("/api/endpoint")
async def endpoint(
    user_permissions: UserPermissions = Depends(require_permission(Permission.DASHBOARD_VIEW))
):
    user_id = user_permissions.user_id
```

### ❌ DON'T: Forget to add Request parameter with rate limiting
```python
# WRONG - Missing Request parameter
@app.post("/api/endpoint")
@limiter.limit("10/minute")
async def endpoint(
    user_permissions: UserPermissions = Depends(require_permission(Permission.DASHBOARD_VIEW))
):
```

### ✅ DO: Include Request when using rate limiter
```python
# CORRECT
@app.post("/api/endpoint")
@limiter.limit("10/minute")
async def endpoint(
    request: Request,  # Required for rate limiter
    user_permissions: UserPermissions = Depends(require_permission(Permission.DASHBOARD_VIEW))
):
```

### ❌ DON'T: Hardcode user roles
```python
# WRONG
if "Administrator" in user_permissions.roles:
    # Do admin stuff
```

### ✅ DO: Use permission checks or is_administrator flag
```python
# CORRECT
if user_permissions.is_administrator:
    # Do admin stuff

# Or check specific permission
if rbac_service.has_permission(user_permissions, Permission.ADMIN_CONFIG_MANAGE):
    # Do admin stuff
```

---

## Adding New Permissions

If you need a new permission that doesn't exist:

### 1. Add to Permission Enum
Edit `backend/rbac_models.py`:

```python
class Permission(str, Enum):
    # ... existing permissions ...
    
    # New category
    REPORTS_VIEW = "reports:view"
    REPORTS_CREATE = "reports:create"
    REPORTS_EXPORT = "reports:export"
```

### 2. Update Built-in Roles
Edit the `BUILT_IN_ROLES` dictionary in `backend/rbac_models.py`:

```python
BUILT_IN_ROLES = {
    "Administrator": RoleDefinition(
        id="built_in_administrator",
        name="Administrator",
        description="Full access to all features",
        permissions=[p.value for p in Permission],  # All permissions
        is_built_in=True
    ),
    "Contributor": RoleDefinition(
        id="built_in_contributor",
        name="Contributor",
        description="Create, read, and update resources",
        permissions=[
            # ... existing permissions ...
            Permission.REPORTS_VIEW.value,
            Permission.REPORTS_CREATE.value,
            Permission.REPORTS_EXPORT.value,
        ],
        is_built_in=True
    ),
    "Reader": RoleDefinition(
        id="built_in_reader",
        name="Reader",
        description="Read-only access",
        permissions=[
            # ... existing permissions ...
            Permission.REPORTS_VIEW.value,
        ],
        is_built_in=True
    ),
}
```

### 3. Use the New Permission
```python
@app.get("/api/reports")
async def get_reports(
    user_permissions: UserPermissions = Depends(require_permission(Permission.REPORTS_VIEW))
):
    """Get all reports. Requires: REPORTS_VIEW permission"""
    return {"reports": [...]}
```

---

## Summary Checklist

When adding a new protected endpoint:

- [ ] Choose appropriate permission(s)
- [ ] Use correct protection pattern (require_permission, require_any_permission, require_admin)
- [ ] Add rate limiting if needed
- [ ] Include "Requires: <PERMISSION>" in docstring
- [ ] Access user info via `user_permissions.user_id`, `user_permissions.user_email`
- [ ] Test without token (should fail with 401)
- [ ] Test with Reader role (should fail/succeed based on permission)
- [ ] Test with Contributor role
- [ ] Test with Administrator role (should always succeed)
- [ ] Update `ENDPOINT-PROTECTION-SUMMARY.md`
- [ ] Commit changes with clear description

---

## Need Help?

- **Permission not working?** Check `RBAC-SETUP.md` for role configuration
- **Token issues?** See `SECURITY-IMPLEMENTATION.md` for authentication flow
- **Rate limiting issues?** Review rate limit configuration in main.py
- **Questions?** Review existing protected endpoints in `backend/main.py` for patterns

Happy coding! 🚀🔒
