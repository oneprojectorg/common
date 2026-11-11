# 0011. Keep routers thin and put business logic in the service layer

Date: 2026-11-11

## Status

Accepted

## Context

One operation has several callers: the browser and server components through
tRPC, Inngest workflows and inbound SMS handlers through a direct import.
Logic inside a tRPC resolver reaches only the first two, so the others copy
it. Most of the 200 or so procedures already follow the rule below; this
records it.

In scope: where business logic, database access and transactions live.
Authentication is [0012](./0012-authenticate-at-the-interface.md)
and authorization is [0013](./0013-authorize-in-the-service-layer-with-access-zones.md).

## Decision

We will keep every tRPC procedure a thin adapter over one function in
`@op/common`.

A procedure picks a tier, declares a Zod `.input()` and `.output()`, calls
one service function with the input and `ctx.user`, and registers its
realtime channels. Nothing else.

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

A service function takes one plain object and returns plain data. It owns
the queries, the transaction, the permission check and the events it sends.
It does not import `@op/api`, read a cookie or header, or use the tRPC
context.

The frontend does not import `@op/db`.

## Consequences

- Workflows, webhooks and tests call the function the router calls, with the
  same permission check, and need no HTTP request.
- Every operation costs two files, even a read that only forwards.
- Eight routers still query the database directly: five under
  `platform/admin`, plus `account/login`, `organization/checkMembership` and
  `organization/inviteUser`. They move to a service when next touched; no
  new router joins them.
- About 25 routers declare no `.output()`, so a new column reaches the
  client unreviewed. They gain a schema when next touched.
- Nothing enforces the rule. A CI rule against `@op/db` imports under
  `services/api/src/routers` could, once the eight are gone.
