# Endpoint Protection Summary

## Overview

All API endpoints have been protected with Role-Based Access Control (RBAC) permissions. This document summarizes the protection applied to each endpoint category.

## Protection Implementation

### Authentication & Authorization Flow

1. **Authentication**: All protected endpoints require a valid JWT bearer token via `Authorization: Bearer <token>` header
2. **Authorization**: Each endpoint checks for specific permissions based on user roles
3. **Role Assignment**: Users are assigned roles (Administrator, Contributor, Reader) in Azure Entra ID
4. **Permission Checking**: The `require_permission()` decorator validates user permissions before allowing access

---

## Protected Endpoints

### 1. Dashboard Endpoints

| Endpoint | Method | Permission Required | Description |
|----------|--------|-------------------|-------------|
| `/api/dashboard/kpis` | GET | `DASHBOARD_VIEW` | Get dashboard KPI data |
| `/api/dashboard/charts` | GET | `DASHBOARD_VIEW` | Get dashboard chart data |

**Who Can Access:**
- ✅ Administrator (full access)
- ✅ Contributor (can view)
- ✅ Reader (can view)

---

### 2. Power BI Endpoints

| Endpoint | Method | Permission Required | Description |
|----------|--------|-------------------|-------------|
| `/api/powerbi/embed-config` | GET | `POWERBI_VIEW` | Get Power BI embed configuration |
| `/api/powerbi/export-pdf` | POST | `POWERBI_EXPORT` | Initiate PDF export (rate limited: 10/min) |
| `/api/powerbi/export-status/{export_id}` | GET | `POWERBI_EXPORT` | Check PDF export status |
| `/api/powerbi/export-file/{export_id}` | GET | `POWERBI_EXPORT` | Download exported PDF file |
| `/api/powerbi/web-url` | GET | `POWERBI_VIEW` | Get Power BI web URL |

**Who Can Access:**
- ✅ Administrator (full access)
- ✅ Contributor (can view, export, refresh)
- ✅ Reader (can view only)

**Special Notes:**
- PDF export is rate-limited to 10 requests per minute per user
- Export endpoints also require the export permission

---

### 3. Chat History Management Endpoints

| Endpoint | Method | Permission Required | Description |
|----------|--------|-------------------|-------------|
| `/api/chat/conversations` | GET | `CHAT_VIEW` | List user's conversations |
| `/api/chat/conversations` | POST | `CHAT_CREATE` | Create new conversation |
| `/api/chat/conversations/{id}` | GET | `CHAT_VIEW` | Get specific conversation |
| `/api/chat/conversations/{id}/messages` | GET | `CHAT_VIEW` | Get conversation messages |
| `/api/chat/conversations/{id}/messages` | POST | `CHAT_CREATE` | Add message to conversation |
| `/api/chat/conversations/{id}` | DELETE | `CHAT_DELETE` | Delete conversation |

**Who Can Access:**
- ✅ Administrator (full access)
- ✅ Contributor (can view, create, delete)
- ❌ Reader (can view only, cannot create or delete)

**Special Notes:**
- Users can only access their own conversations
- Deletion is soft delete (marks as deleted)

---

### 4. Copilot Studio Endpoints

| Endpoint | Method | Permission Required | Description |
|----------|--------|-------------------|-------------|
| `/api/copilot-studio/token` | POST | `CHAT_VIEW` | Initialize Copilot Studio session |
| `/api/copilot-studio/send-message` | POST | `CHAT_CREATE` | Send message to Copilot Studio (rate limited: 30/min) |
| `/api/copilot-studio/send-card-response` | POST | `CHAT_CREATE` | Send card response to Copilot Studio |

**Who Can Access:**
- ✅ Administrator (full access)
- ✅ Contributor (can create sessions and send messages)
- ❌ Reader (can view only, cannot send messages)

**Special Notes:**
- Message sending is rate-limited to 30 requests per minute per user
- Uses On-Behalf-Of (OBO) flow for user impersonation

---

### 5. Azure AI Foundry Endpoints

| Endpoint | Method | Permission Required | Description |
|----------|--------|-------------------|-------------|
| `/api/ai-foundry/token` | POST | `AI_FOUNDRY_QUERY` | Initialize AI Foundry session |
| `/api/ai-foundry/send-message` | POST | `AI_FOUNDRY_QUERY` | Send message to AI Foundry (rate limited: 30/min) |
| `/api/ai-foundry/send-card-response` | POST | `AI_FOUNDRY_QUERY` | Send card response to AI Foundry |

**Who Can Access:**
- ✅ Administrator (full access including advanced features)
- ✅ Contributor (can query with advanced features)
- ✅ Reader (can query with basic features only)

**Special Notes:**
- Message sending is rate-limited to 30 requests per minute per user
- Advanced AI features require `AI_FOUNDRY_ADVANCED` permission (Administrator and Contributor only)

---

### 6. Query Template Management Endpoints

| Endpoint | Method | Permission Required | Description |
|----------|--------|-------------------|-------------|
| `/api/query-templates` | GET | `TEMPLATES_VIEW` | List query templates |
| `/api/query-templates` | POST | `TEMPLATES_CREATE` | Create new template |
| `/api/query-templates/{id}` | GET | `TEMPLATES_VIEW` | Get specific template |
| `/api/query-templates/{id}` | PUT | `TEMPLATES_UPDATE` | Update template |
| `/api/query-templates/{id}` | DELETE | `TEMPLATES_DELETE` | Delete template |

**Who Can Access:**
- ✅ Administrator (full access)
- ✅ Contributor (can view, create, update, delete)
- ✅ Reader (can view only)

**Special Notes:**
- Users can only update/delete templates they own
- Public templates are visible to all authenticated users

---

### 7. RBAC Management Endpoints

| Endpoint | Method | Permission Required | Description |
|----------|--------|-------------------|-------------|
| `/api/rbac/permissions` | GET | Authenticated | Get current user's permissions |
| `/api/rbac/roles` | GET | `ADMIN_ROLES_VIEW` | List all roles |
| `/api/rbac/roles` | POST | `ADMIN_ROLES_MANAGE` | Create custom role |
| `/api/rbac/roles/{id}` | PUT | `ADMIN_ROLES_MANAGE` | Update custom role |
| `/api/rbac/roles/{id}` | DELETE | `ADMIN_ROLES_MANAGE` | Delete custom role |
| `/api/rbac/permissions/available` | GET | `ADMIN_ROLES_VIEW` | List all available permissions |

**Who Can Access:**
- ✅ Administrator (full access)
- ❌ Contributor (no access)
- ❌ Reader (no access)

**Special Notes:**
- Only administrators can manage roles
- Built-in roles (Administrator, Contributor, Reader) cannot be modified or deleted
- Any authenticated user can view their own permissions

---

### 8. Configuration Endpoints

| Endpoint | Method | Permission Required | Description |
|----------|--------|-------------------|-------------|
| `/api/config/ui` | GET | Authenticated | Get UI configuration |
| `/api/config/visualization-instructions` | GET | Authenticated | Get visualization instructions |

**Who Can Access:**
- ✅ All authenticated users

**Special Notes:**
- These endpoints were previously public
- Now require authentication to prevent information disclosure
- No specific permission required beyond valid authentication

---

### 9. Public Endpoints (No Authentication Required)

| Endpoint | Method | Authentication | Description |
|----------|--------|---------------|-------------|
| `/health` | GET | None | Health check endpoint |
| `/api/config/features` | GET | None | Legacy feature config (deprecated) |

**Special Notes:**
- Health check is intentionally public for monitoring
- Legacy feature endpoint maintained for backwards compatibility

---

## Permission Matrix by Role

### Administrator Role (Full Access)
```
✅ ALL PERMISSIONS (37 permissions)
```

### Contributor Role (14 permissions)
```
✅ dashboard:view          ✅ dashboard:export
✅ chat:view               ✅ chat:create              ✅ chat:delete
✅ powerbi:view            ✅ powerbi:export           ✅ powerbi:refresh
✅ templates:view          ✅ templates:create         ✅ templates:update         ✅ templates:delete
✅ ai_foundry:query        ✅ ai_foundry:advanced
```

### Reader Role (7 permissions)
```
✅ dashboard:view
✅ chat:view
✅ powerbi:view
✅ templates:view
✅ ai_foundry:query
✅ admin:audit:view
```

---

## Rate Limiting

In addition to RBAC permissions, the following endpoints have rate limits:

| Endpoint | Rate Limit | Reason |
|----------|-----------|--------|
| **All endpoints** | 200 requests/minute | Global protection against abuse |
| `/api/powerbi/export-pdf` | 10 requests/minute | Resource-intensive operation |
| `/api/copilot-studio/send-message` | 30 requests/minute | Prevent chat spam |
| `/api/ai-foundry/send-message` | 30 requests/minute | Prevent AI query abuse |

**Rate Limit Behavior:**
- Limits are per IP address
- Exceeding limits returns HTTP 429 (Too Many Requests)
- Rate limits reset after the time window expires

---

## Testing Endpoint Protection

### Test Authentication
```bash
# Should fail with 401 Unauthorized
curl http://localhost:8000/api/dashboard/kpis

# Should succeed with valid token
curl -H "Authorization: Bearer <your-token>" \
  http://localhost:8000/api/dashboard/kpis
```

### Test Permission Enforcement
```bash
# As Reader - should succeed (has DASHBOARD_VIEW)
curl -H "Authorization: Bearer <reader-token>" \
  http://localhost:8000/api/dashboard/kpis

# As Reader - should fail with 403 Forbidden (lacks CHAT_CREATE)
curl -X POST -H "Authorization: Bearer <reader-token>" \
  -H "Content-Type: application/json" \
  -d '{"agent_id": "copilot", "title": "Test"}' \
  http://localhost:8000/api/chat/conversations

# As Contributor - should succeed (has CHAT_CREATE)
curl -X POST -H "Authorization: Bearer <contributor-token>" \
  -H "Content-Type: application/json" \
  -d '{"agent_id": "copilot", "title": "Test"}' \
  http://localhost:8000/api/chat/conversations

# As Reader - should fail with 403 Forbidden (lacks ADMIN_ROLES_VIEW)
curl -H "Authorization: Bearer <reader-token>" \
  http://localhost:8000/api/rbac/roles

# As Administrator - should succeed
curl -H "Authorization: Bearer <admin-token>" \
  http://localhost:8000/api/rbac/roles
```

### Test Rate Limiting
```bash
# Send 250 requests rapidly - should see 429 after 200
for i in {1..250}; do
  curl -H "Authorization: Bearer <token>" \
    http://localhost:8000/api/dashboard/kpis &
done
```

---

## Security Benefits

### 1. **Defense in Depth**
- 7 layers of security (Network, Rate Limiting, Headers, CORS, Auth, RBAC, Audit)
- Multiple safeguards prevent single point of failure

### 2. **Principle of Least Privilege**
- Users only get permissions they need
- Readers cannot modify data
- Contributors cannot manage users or roles
- Only Administrators have full access

### 3. **Audit Trail**
- Every request logged with user identity
- Security events tracked
- Compliance-ready logging

### 4. **Resource Protection**
- Rate limiting prevents DDoS
- Expensive operations (PDF export) have strict limits
- Service remains available under load

### 5. **Data Isolation**
- Users can only access their own conversations
- Templates ownership enforced
- No cross-user data leakage

---

## Next Steps

1. **Assign Roles in Azure Entra ID**
   - Configure App Roles in App Registration
   - Assign users to roles in Enterprise Applications
   - See `RBAC-SETUP.md` for detailed instructions

2. **Test All Roles**
   - Create test users for each role
   - Verify permission enforcement
   - Test rate limiting behavior

3. **Monitor Security Events**
   - Review audit logs regularly
   - Set up alerts for suspicious activity
   - Track rate limit violations

4. **Document User Access**
   - Maintain list of who has which roles
   - Review role assignments quarterly
   - Audit permission usage

---

## Troubleshooting

### "401 Unauthorized" Error
- Check Authorization header is present: `Authorization: Bearer <token>`
- Verify token is valid (check at jwt.ms)
- Ensure token hasn't expired

### "403 Forbidden" Error
- User doesn't have required permission
- Check user's role assignments in Azure Portal
- Verify role includes needed permission
- Call `/api/rbac/permissions` to see user's permissions

### "429 Too Many Requests" Error
- Rate limit exceeded
- Wait for rate limit window to reset
- Check if multiple clients are using same IP
- Review if rate limits need adjustment

### Permission Not Working
- User may need to sign out and back in after role assignment
- Token cache (5 min) may have old permissions
- Verify App Roles are defined in Azure Entra ID
- Check backend logs for RBAC service errors

---

## References

- **RBAC Setup**: See `RBAC-SETUP.md` for complete role configuration guide
- **Security Implementation**: See `SECURITY-IMPLEMENTATION.md` for security architecture
- **Permission Definitions**: See `backend/rbac_models.py` for all 37 permissions
- **Role Service**: See `backend/rbac_service.py` for permission checking logic

---

## Summary

✅ **All 30+ endpoints are now protected with RBAC**
✅ **3 built-in roles with appropriate permissions**
✅ **Rate limiting prevents abuse**
✅ **Audit logging tracks all access**
✅ **Defense-in-depth security architecture**

Your Call Center AI Insights API now has **enterprise-grade security** with comprehensive access control! 🔒
