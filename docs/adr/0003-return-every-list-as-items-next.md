# 0003. Return every list as `{ items, next }` from one schema factory

Date: 2026-09-08

## Status

Accepted

## Context

About fifty tRPC procedures return a list, across nine envelope shapes: nine
different item keys, a cursor that is sometimes nullable and sometimes nullish,
ad hoc `total` and `hasMore` fields, offset encoders, and bare arrays. None is
an extension of another, so nothing can be written once against "a list" —
clients special-case the key name in every `flatMap` and every cache write.

In scope: the output envelope of list procedures, the cursor/limit input, and
where the factories live. The rule covers query procedures that return a
collection: a mutation's per-item result
(`platform.admin.addUsersToOrganization`) and a record keyed by type
(`profile.getRelationships`) are not lists and stay as they are. Out of
scope: cursor encoding (`packages/common/src/utils/db.ts`), sort inputs, and
the item schemas.

## Decision

We return every list from a tRPC procedure as one of two envelopes, the second
extending the first, both built by factories in `@op/common`
(`packages/common/src/utils/pagination.ts`, also exported from
`@op/common/client`):

```ts
list(item); // { items: T[] } — an envelope with no continuation cursor
paginated(item); // { items: T[], next: string | null } — one page
paginated(item).extend({ total }); // opt-in filter-wide count

paginationInput('md'); // { cursor?: string | null, limit: number }
```

`list` says only that the envelope carries no continuation cursor. Any bound
on the result — an offset input, a fixed cap like the submitter face-pile — is
the endpoint's, and is documented there.

The item key is always `items`. `next` is an opaque cursor and is `null`, never
`undefined`, on the last page. `hasMore` is not on the wire: it is
`next !== null`.

Per-request metadata — `total`, `collectionId`, `canManageProposals`,
`rubricTemplate` — is added with `.extend()`, so every list schema stays a
structural extension of the two bases. `total` is opt-in, and only for a count
the UI shows.

A paginated procedure takes `paginationInput(tier)`, whose `limit` defaults to
the named `PAGE_LIMIT` tier (`sm` | `md` | `lg`) and is capped at
`PAGE_LIMIT.max`. We add no new offset-based inputs.

The cursor field is `next` rather than tRPC's documented `nextCursor`: the
input field is already `cursor`, so `nextCursor` would only repeat it.

## Consequences

- One `getNextPageParam`, one `pages.flatMap((p) => p.items)`,
  and a `Paginated<T>` the service layer, the encoders, and the client share.
- A new list procedure is one line of output schema and cannot invent a shape.
- Renaming a domain-keyed envelope (`proposals`, `assignments`) breaks the
  client, so each lands per domain together with its consumers.
- Emitting `total` costs a `COUNT` per request, so it has to be justified.
- The legacy offset encoders keep working and move to a cursor when next
  touched.

## References

- tRPC [`useInfiniteQuery`](https://trpc.io/docs/client/react/useInfiniteQuery)
  — `{ items, nextCursor }` with a nullish `cursor` input.
- [express-zod-api](https://github.com/RobinTail/express-zod-api)
  `ez.paginated()` — a factory for the input/output pair; its configurable
  `itemsName` is the option we deliberately do not offer.
- [Stripe list objects](https://docs.stripe.com/api/pagination) —
  `{ data, has_more }`.
