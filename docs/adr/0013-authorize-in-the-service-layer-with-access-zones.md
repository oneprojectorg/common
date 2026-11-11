# 0013. Authorize in the service layer with access-zones

Date: 2026-11-11

## Status

Accepted

## Context

Whether a caller may act on a record depends on the record: its profile, the
caller's roles there, sometimes its state. A check in the router protects
only the tRPC path, and the same service is also called from workflows and
SMS commands ([0011](./0011-keep-routers-thin-and-put-logic-in-the-service-layer.md)).
This records current practice.

In scope: where a permission check runs and what it is built from. Who the
caller is belongs to
[0012](./0012-authenticate-at-the-boundary.md).

## Decision

We will authorize inside the service function, before it reads or writes
anything the caller may not see.

A service that acts for a user takes `user: User` as an argument and asserts
access through a helper in `packages/common/src/services/assert` or
`packages/common/src/services/access`:

```ts
await assertProfileAccess({
  user,
  profileId,
  permissions: { decisions: permission.ADMIN },
});
```

The helper loads the caller's roles on the profile and evaluates them with
`checkPermission` from `access-zones`. A role grants create, read, update,
delete or admin on a named zone (`decisions`, `profile`, ...). The helper
throws `UnauthorizedError` on failure.

A check several services share becomes a named helper
(`assertCategoryReviewerAdmin`), not a copy of the role query.

A router adds no permission check of its own.

## Consequences

- Every caller gets the same check, including those with no HTTP request.
- The check and the mutation can share a transaction and the rows they read.
- Authorization is tested by passing a different `user`, with no session to
  fake.
- The check is opt-in. A service that forgets it is open to every caller the
  tier admits, and neither types nor CI notice.
- A system caller (a scheduled workflow, a webhook) has no user. It calls a
  function that takes no `user` and makes no check, so that function must
  not be reachable from a router.
- The role lookup is memoized per request and cached across requests, so a
  role change takes effect only when the code that makes it invalidates the
  cache.
