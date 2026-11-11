# 0017. Fetch client data with suspense queries inside error boundaries

Date: 2026-11-11

## Status

Accepted

## Context

A component that fetches with `useQuery` has to handle loading, error and
empty data itself, and each one does it differently. Fetching in `useEffect`
adds a render with no data and a race on every change of input. This records
the rule already in force.

In scope: how a client component reads server data. Out of scope: mutations
and server components.

## Decision

We will read server data in client components with tRPC suspense queries
(`useSuspenseQuery`, `useSuspenseInfiniteQuery`), each under a `Suspense`
boundary and an error boundary.

The component treats the data as present. The nearest `Suspense` renders the
loading state. The nearest error boundary renders the failure:

- `APIErrorBoundary` picks a fallback by the HTTP status of the tRPC error.
- `ResourceErrorBoundary` turns 400 and 404 into `notFound()` and 403 into
  `forbidden()`, for a page built around one record.

We do not fetch in `useEffect`. A plain `useQuery` is for a query that has
to stay disabled until some input exists, which a suspense query cannot do.

## Consequences

- A component has no loading or error branches, and `data` is never
  `undefined` in its types.
- Loading and error states are placed by layout, once per region.
- A suspense query with no error boundary sends its failure to `error.tsx`
  as a 500, even for a 403 or 404.
- A suspense query with no close `Suspense` blanks a larger part of the page
  than intended.
- Sibling suspense queries in one component run one after another unless
  they are prefetched or combined.
