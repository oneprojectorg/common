# 0011. Keep routers thin and put business logic in the service layer

Date: 2026-11-11

## Status

Accepted

## Context

The same business operation has more than one caller. A browser reaches it
through tRPC, a server component through the server-side tRPC caller, an
Inngest workflow through a direct import, and an inbound SMS command through
a workflow handler. Logic written inside a tRPC resolver is reachable from
the first two only, so every other caller has to copy it.

This ADR records a decision that is already in force. The codebase has about
200 tRPC procedures in `services/api` (`@op/api`) and about 480 service files
in `packages/common` (`@op/common`), and most procedures already follow the
rule below. It was never written down, so the exceptions have no label and a
new procedure has no rule to be checked against.

In scope: where business logic, database access and transactions live. Out of
scope: authentication ([its own ADR](./0012-authenticate-in-the-router-through-procedure-tiers.md)),
authorization ([its own ADR](./0013-authorize-in-the-service-layer-with-access-zones.md)),
and the layout of files inside `@op/common`.

## Decision

We will keep every tRPC procedure a thin adapter and put the operation itself
in a function in `@op/common`.

A procedure lives in its own file and does four things: it picks a procedure
tier, declares a Zod `.input()` and `.output()`, calls one service function
with the input and `ctx.user`, and registers the realtime channels the call
reads or changes.

```ts
export const addCategoryReviewerRouter = router({
  addCategoryReviewer: networkAuthenticatedProcedure()
    .input(addCategoryReviewerInputSchema)
    .output(categoryReviewerEncoder)
    .mutation(({ ctx, input }) =>
      addCategoryReviewer({ ...input, user: ctx.user }),
    ),
});
```

A service function takes one plain object and returns plain data. It owns the
queries, the transaction, the permission check and the events it sends. It
does not import from `@op/api`, read a cookie or a request header, or depend
on the tRPC context.

The frontend does not import `@op/db`. It reaches data through tRPC.

## Consequences

- A workflow, a webhook and a test call the same function the router calls,
  with the same permission check.
- A service is testable without an HTTP request or a tRPC caller.
- Every operation costs two files, and a trivial read is a router file that
  only forwards.
- Eight routers still query the database directly: five under
  `platform/admin`, plus `account/login`, `organization/checkMembership` and
  `organization/inviteUser`. They move into a service when next touched, and
  no new router joins them.
- About 25 router files declare no `.output()`. Each one returns whatever its
  service returns, so a new column reaches the client unreviewed. They gain a
  schema when next touched.
- Nothing enforces the rule yet. A boundary rule that fails CI on a `@op/db`
  import under `services/api/src/routers` would, once the eight are gone.
