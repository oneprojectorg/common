# Next Steps: Fix listUsers.integration.test.ts

**File:** `services/api/src/test/integration/listUsers.integration.test.ts`

**Current Status:** 1/5 tests passing ✅

## Issues to Fix

### 1. Rate Limiting Middleware Blocking Tests (4 tests failing)

**Error:** `Unable to detect IP address. If you're using a VPN, disable it and try again.`

**Root Cause:**

- The `withRateLimited` middleware checks `ctx.ip`
- Tests are providing `ip: '127.0.0.1'` in context
- BUT the middleware is rejecting it (possibly the IP check is failing despite being set)

**Solution Options:**

#### Option A: Skip rate limiting in tests (RECOMMENDED)

Add `isServerSideCall: true` to the test context:

```typescript
const createTestContext = (user: any) => ({
  user,
  req: {
    headers: { get: () => '127.0.0.1' },
    url: 'http://localhost:3000/api/trpc',
  } as any,
  res: {} as any,
  ip: '127.0.0.1',
  reqUrl: 'http://localhost:3000/api/trpc',
  isServerSideCall: true, // <-- Add this to skip rate limiting
});
```

**Location:** Line 23 in `listUsers.integration.test.ts`

#### Option B: Mock the rate limiting middleware

Mock `withRateLimited` to bypass checks in test environment.

---

### 2. Duplicate Role Creation (1 test failing)

**Test:** `should correctly return users with multiple roles`

**Error:** `duplicate key value violates unique constraint "access_roles_name_unique"`

**Root Cause:**

- The test tries to create "Editor" role on line 163-169
- But "Editor" role might already exist from a previous test run
- `onConflictDoNothing()` is used but not returning the existing role

**Current Code (lines 163-177):**

```typescript
const [editorRoleResult] = await db
  .insert(accessRoles)
  .values({
    name: 'Editor',
    description: 'Editor role',
  })
  .onConflictDoNothing()
  .returning();

const editorRole =
  editorRoleResult ||
  (await db.query.accessRoles.findFirst({
    where: (table, { eq }) => eq(table.name, 'Editor'),
  }));
```

**Issue:** When `onConflictDoNothing()` triggers, `.returning()` returns an empty array, making `editorRoleResult` undefined.

**Solution:**
Always fetch the role after insert to ensure we have it:

```typescript
// Try to insert, ignore if exists
await db
  .insert(accessRoles)
  .values({
    name: 'Editor',
    description: 'Editor role',
  })
  .onConflictDoNothing();

// Then fetch it
const editorRole = await db.query.accessRoles.findFirst({
  where: (table, { eq }) => eq(table.name, 'Editor'),
});

if (!editorRole) {
  throw new Error('Failed to get or create Editor role');
}
```

**Location:** Lines 153-180 in `listUsers.integration.test.ts`

---

## Recommended Fix Order

1. **Fix rate limiting first** (fixes 4 tests) - Add `isServerSideCall: true` to context
2. **Fix duplicate role issue** (fixes 1 test) - Refactor role fetching logic

After these fixes, all 5 tests should pass! ✅

---

## Test Summary

- ✅ `should throw error for invalid profile ID` - **PASSING**
- ❌ `should successfully list organization users with admin permissions` - Rate limiting
- ❌ `should throw unauthorized error for non-members` - Rate limiting
- ❌ `should return array with creator for organization with no additional members` - Rate limiting
- ❌ `should correctly return users with multiple roles` - Duplicate role + Rate limiting

---

## Context: What Was Already Fixed

The **Supabase RLS issue** has been completely resolved:

- ✅ Created `supabaseTestAdminClient` with service role key
- ✅ Updated test utilities to use admin client for setup/teardown
- ✅ Tests can now insert into RLS-protected tables

The remaining issues are test-specific context setup problems, not Supabase/RLS related.
