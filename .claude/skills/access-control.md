---
name: access-control
description: How authorization works via the access-zones library and our wrappers around it. Use whenever adding or modifying a tRPC procedure, server action, service-layer function, or route that requires specific permissions — and whenever gating UI on the client.
---

## The library

The base library is the external NPM package `access-zones`. We wrap it inside `packages/common/src/services/access/index.ts`. Always go through our wrappers — they load + normalize roles correctly. Don't import from `access-zones` directly in feature code.

## Vocabulary

- **Zone** — a permission domain. The three in active use: `profile`, `decisions`, `admin` (admin is mostly legacy, prefer the others).
- **Permission bitfield** — `permission.ADMIN | CREATE | READ | UPDATE | DELETE` plus decision-specific bits: `INVITE_MEMBERS`, `REVIEW`, `SUBMIT_PROPOSALS`, `VOTE`. Compose with `|` for "any of".
- **Built-in roles** — `Admin` (full) and `Member` (read profile, read+vote on decisions). See `services/db/seedData/accessControl.ts` for the canonical definitions.

## Backend — the only patterns you should be writing

### 1. Get the user

Inside a tRPC procedure, the `withAuthenticated` middleware (`services/api/src/middlewares/withAuthenticated.ts`) injects `ctx.user` (Supabase user). Use it.

For server actions / service-layer code reached from outside tRPC, use the helpers in `packages/common/src/services/access/`:
- `getCurrentOrgId(authUserId)`
- `getCurrentProfileId(authUserId)`

### 2. Load the access user (carries normalized roles)

Pick the wrapper for the scope you're checking:

```ts
import {
  getOrgAccessUser,
  getProfileAccessUser,
} from "@op/common/services/access";

const orgUser = await getOrgAccessUser({ user, organizationId });
// or
const profileUser = await getProfileAccessUser({ user, profileId });
```

These return the user with `roles: NormalizedRole[]` attached. That `roles` array is what every check below takes as input.

### 3. Assert (throw on missing permission)

Use for mutations and any code path where lacking permission means the request is invalid.

```ts
import { assertAccess, permission } from "@op/common/services/access";

assertAccess({ profile: permission.UPDATE }, orgUser?.roles ?? []);
```

Real example: `packages/common/src/services/organization/updateOrganization.ts:42–48`.

### 4. Check (boolean, no throw)

Use when you need to branch on permission — e.g., a list endpoint that returns more fields to admins:

```ts
import { checkPermission, permission } from "@op/common/services/access";

const isAdmin = checkPermission(
  { profile: permission.ADMIN },
  profileUser.roles,
);
```

Real example: `packages/common/src/services/decision/getInstance.ts:44–48`.

### 5. Convenience wrappers

For the common case "is this user a profile admin?" use the dedicated assert rather than spelling out the bitfield:

```ts
import { assertProfileAdmin } from "@op/common/services/assert/assertProfileAdmin";

await assertProfileAdmin(user, profileId);
```

Source: `packages/common/src/services/assert/assertProfileAdmin.ts`.

## Frontend — gating UI

Use the declarative `<AccessBoundary>` component instead of computing access in render bodies:

```tsx
import { AccessBoundary } from "@/components/AccessBoundary";

<AccessBoundary
  required={{ profile: { admin: true } }}
  profileId={id}
  fallback={<Unauthorized />}
>
  {children}
</AccessBoundary>
```

Source: `apps/app/src/components/AccessBoundary.tsx`. It pulls permissions from the `UserProvider` context (no extra fetch).

If you need a boolean in code (to enable/disable a button, etc.), reach for the same context — don't roll your own role check.

## Don't

- **Don't roll your own role check.** No `if (user.role === "admin")`, no manual array scanning, no string comparison against role names. Use `assertAccess` / `checkPermission`.
- **Don't import `access-zones` directly** in feature code — go through `@op/common/services/access` so role normalization stays consistent.
- **Don't gate on the client only.** Every mutation that touches another user's data must assert on the server. Client gating is for UX, not security.
- **Don't skip a check on a "private" procedure.** If the data is scoped to a user/org/profile, assert the scope explicitly.
- **Don't invent a new zone.** If you think you need one, raise it before adding code — zones touch the seed data and role definitions in `services/db/seedData/accessControl.ts`.

## Quick reference

| Need | Use | File |
|---|---|---|
| Throw if user can't update profile | `assertAccess({ profile: permission.UPDATE }, roles)` | `services/access/index.ts` |
| Boolean check for decision admin | `checkPermission({ decisions: permission.ADMIN }, roles)` | `services/access/index.ts` |
| Profile admin shortcut | `assertProfileAdmin(user, profileId)` | `services/assert/assertProfileAdmin.ts` |
| Org-scoped roles | `getOrgAccessUser({ user, organizationId })` | `services/access/index.ts` |
| Profile-scoped roles | `getProfileAccessUser({ user, profileId })` | `services/access/index.ts` |
| Hide UI from non-admins | `<AccessBoundary required={{ profile: { admin: true } }} />` | `components/AccessBoundary.tsx` |
| Permission bitfield | `permission.ADMIN \| CREATE \| READ \| UPDATE \| DELETE` (+ decision bits) | `services/access/index.ts` |
