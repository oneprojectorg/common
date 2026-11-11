# 0013. Authorize in the service layer with access-zones

Date: 2026-11-11

## Status

Accepted

## Context

Whether a caller may act on a record depends on the record: the profile it
belongs to, the roles the caller holds on that profile, and sometimes the
state of the record itself. Answering that needs a database read, usually of
the same rows the operation is about to change.

A check made in the router protects only the tRPC path. The same operation is
also called from Inngest workflows and from inbound SMS commands
([thin routers ADR](./0011-keep-routers-thin-and-put-logic-in-the-service-layer.md)),
and a check that lives one layer up is silently absent on those paths.

This ADR records a decision that is already in force: `@op/common` makes
about 130 `assert*Access` calls and the routers make four. In scope: where a
permission check runs and what it is built from. Out of scope: who the caller
is, which the router settles
([procedure tiers ADR](./0012-authenticate-in-the-router-through-procedure-tiers.md)),
and the design of roles and zones themselves.

## Decision

We will authorize inside the service function, before it reads or writes
anything the caller may not see.

A service that acts for a user takes that user as an argument (`user: User`),
never from a session, a cookie or the tRPC context. It then asserts access
through a helper in `packages/common/src/services/assert` or
`packages/common/src/services/access`:

```ts
await assertProfileAccess({
  user,
  profileId,
  permissions: { decisions: permission.ADMIN },
});
```

The helper loads the caller's roles on the profile and evaluates them with
`checkPermission` from the `access-zones` library. A role grants create,
read, update, delete or admin on a named zone (`decisions`, `profile`, and so
on). A helper throws `UnauthorizedError` on failure, so a caller cannot
ignore the result.

A check that several services share becomes a named helper
(`assertCategoryReviewerAdmin`, `assertInstanceProfileAccess`) and not a copy
of the role query.

A router adds no permission check of its own. It picks a tier, which decides
who may call at all, and leaves what the caller may do to the service.

## Consequences

- Every caller of a service gets the same check, including the ones with no
  HTTP request.
- The check and the mutation can share a transaction and the rows they read.
- A service is tested for authorization by passing it a different `user`,
  with no session to fake.
- The check is opt-in. A service that forgets it is open to every caller the
  tier admits, and neither the types nor CI notice. About a third of service
  files take a `user`; the rest are helpers, system paths, or unchecked.
- A system caller — a scheduled workflow, a webhook — has no user to pass. It
  calls a function that takes no `user` and makes no check, so that function
  must not be reachable from a router.
- Authorization costs a role lookup per call. The lookup is memoized within
  a request and cached across requests, so a role change takes effect only
  when the code that makes it invalidates that cache.
