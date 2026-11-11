# 0011. Keep routers thin and put business logic in the service layer

Date: 2026-11-11

## Status

Accepted

## Context

One operation has several callers: the browser and server components through
tRPC, Inngest workflows and inbound SMS handlers through a direct import.
Logic inside a tRPC resolver reaches only the first two, so the others copy
it. This records the rule already in force.

In scope: where business logic, database access and transactions live.
Authentication is [0012](./0012-authenticate-at-the-boundary.md)
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
- The `.output()` schema is the only review of what reaches the client. A
  procedure without one returns whatever its service returns.
