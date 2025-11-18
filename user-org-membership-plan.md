# Platform Admin: Organization Membership Management Plan

## Overview

This document outlines the plan for implementing platform admin functionality to manage user memberships in organizations, starting with adding users to organizations.

## Existing Infrastructure

### Database Schema

**`services/db/schema/tables/organizationUsers.sql.ts`**

- `organizationUsers` table: Maps users to organizations with fields:
  - `id`, `authUserId`, `name`, `email`, `about`, `organizationId`, timestamps
- `organizationUserToAccessRoles` junction table: Maps organization users to access roles
  - Supports multiple roles per user with cascade delete
- Relations include `serviceUser`, `organization`, and `roles`

**`services/db/schema/tables/access.sql.ts`**

- `accessRoles` table: Defines available roles (Admin, Editor, Viewer, etc.)
- Roles have `id`, `name`, `description`

### Reusable Business Logic

**Location**: `packages/common/src/services/organization/`

- **`inviteUsersToOrganization()`** (`inviteUsers.ts:75-271`)

  - Validates inviter has admin permissions
  - Handles existing users vs new users
  - Adds existing users directly to organization
  - Creates allowList entries for new users
  - Sends batch invitation emails
  - Returns detailed success/failure results

- **`updateOrganizationUser()`** (`updateOrganizationUser.ts:28-144`)

  - Updates basic user info (name, email, about)
  - Manages role assignments (add/remove multiple roles)
  - Validates role IDs
  - Invalidates cache after update

- **`deleteOrganizationUser()`** (`deleteOrganizationUser.ts:16-77`)

  - Removes users from organizations
  - Cascade deletes role assignments
  - Invalidates cache after deletion

- **`getOrganizationUsers()`** (`getOrganizationUsers.ts:8-99`)
  - Fetches all users with roles and profile data
  - Returns formatted user data with avatars

### Existing Organization Endpoints

**Location**: `services/api/src/routers/organization/`

These endpoints require the caller to be a member of the organization:

1. **`organization.invite`** - Adds/invites users with roles
2. **`organization.listUsers`** - Lists organization members
3. **`organization.updateOrganizationUser`** - Updates user roles/info
4. **`organization.deleteOrganizationUser`** - Removes users
5. **`organization.getRoles`** - Gets available access roles

### Platform Admin Infrastructure

**Location**: `services/api/src/routers/platform/admin/`

- **Auth middleware**: `withAuthenticatedPlatformAdmin` (bypasses org-level permissions)
- **Example endpoint**: `platform.admin.listAllUsers` - Shows pagination + search patterns

## Design Decisions

### 1. Endpoint Naming: `addUsersToOrganization`

**Chosen**: Plural users, singular organization

**Rationale**:

- ✅ Matches existing pattern: `inviteUsersToOrganization()` in business logic
- ✅ Common use case: Adding multiple users to ONE organization at once (batch operation)
- ✅ Clear and specific scope
- ✅ Simpler error handling than multi-org operations

**Rejected**: `addUsersToOrganizations` (both plural)

- ❌ Unusual use case - rarely need to add same users to multiple orgs at once
- ❌ More complex input structure and validation
- ❌ Complex error handling for partial failures across orgs

### 2. Role Assignment: Combined in Single Endpoint

**Chosen**: Include roleIds in the add operation

**Rationale**:

- ✅ **Atomic operation**: Adding a user to org without roles is incomplete - both should happen in one transaction
- ✅ **Matches existing patterns**: `inviteUsersToOrganization` already includes `roleIds` in invitation metadata
- ✅ **Better UX**: The UI will have role selection as part of the "add user" flow anyway
- ✅ **Simpler error handling**: Either the whole operation succeeds or fails
- ✅ **Fewer round trips**: One API call instead of two
- ✅ **No inconsistent state**: User and roles created together

**Rejected**: Separate endpoint for role assignment

- ❌ Two operations for one logical action
- ❌ User exists in org without roles temporarily (inconsistent state)
- ❌ More API calls needed
- ❌ Complex error handling if user added but role assignment fails

**Note**: We already have `organization.updateOrganizationUser` for changing roles after initial assignment.

## Proposed Implementation

### New Endpoint Signature

```typescript
platform.admin.addUsersToOrganization({
  organizationId: uuid,
  users: Array<{
    authUserId?: uuid; // For existing users
    email?: string; // For inviting new users
    roleIds: uuid[]; // Required: at least one role
  }>,
});
```

### Features

- **Batch operation**: Add multiple users to one organization at once
- **Existing users**: Use `authUserId` to add users who already have accounts
- **New users**: Use `email` to invite users who need to create accounts
- **Role assignment**: Assign one or more roles to each user immediately
- **Transaction**: All user additions and role assignments happen atomically
- **Authorization**: Uses `withAuthenticatedPlatformAdmin` middleware (bypasses org membership checks)

### Key Differences from Existing `organization.invite`

1. **Authorization**: Platform admin can add users to ANY organization (not just orgs they're members of)
2. **No permission checks**: Skips `getOrgAccessUser()` + `assertAccess()` checks
3. **Uses platform admin middleware**: `withAuthenticatedPlatformAdmin` instead of organization-level auth

### Implementation Approach

1. Create new endpoint in `services/api/src/routers/platform/admin/addUsersToOrganization.ts`
2. Use `withAuthenticatedPlatformAdmin` middleware
3. Reuse business logic from `inviteUsersToOrganization()` but bypass org-level authorization
4. Validate:
   - Organization exists
   - Role IDs are valid
   - Users are not already members (or handle gracefully)
5. Use database transaction for atomic operation
6. Invalidate relevant caches (`user`, `orgUser`)
7. Return success/failure results for each user

## Future Endpoints

Based on the same patterns, we'll need:

- **`platform.admin.listOrganizationUsers`** - List members of any organization
- **`platform.admin.updateOrganizationUser`** - Update user roles/info in any organization
- **`platform.admin.removeUserFromOrganization`** - Remove users from any organization

These will follow the same pattern: reuse existing business logic but with platform admin authorization instead of org membership checks.
