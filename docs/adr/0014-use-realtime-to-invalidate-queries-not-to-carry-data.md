# 0014. Use realtime to invalidate queries, not to carry data

Date: 2026-11-11

## Status

Accepted

## Context

Several people work on one decision at once, so a screen has to update
without a reload. Pushing the changed record over the socket gives data a
second path to the client, one that skips the procedure tier, the service's
permission check and the output encoder. This records what the code already
does.

In scope: how a server-side change reaches other clients. Out of scope: the
realtime provider, presence, and collaborative document editing.

## Decision

We will send only a signal over realtime. A message names a channel and the
mutation that caused it, and carries no record. A client that receives one
invalidates the queries bound to that channel and refetches them through
tRPC.

Channels come from the `Channels` helpers in
`packages/common/src/realtime/channels`. A router declares them:

- a query calls `ctx.registerQueryChannels([...])` with the channels whose
  changes make its result stale;
- a mutation calls `ctx.registerMutationChannels([...])` with the channels
  it changed.

The `withChannelMeta` middleware returns the channels with the response and,
for a mutation, publishes to them after the response is sent, tagged with
the request id. The client records each query's channels, subscribes, and
invalidates on a message. The client that made the mutation invalidates from
the response and skips the message that echoes its own request id.

Publishing is best effort: a three-second timeout, one retry, a failure
counted on `realtime.publish.failures`. A failed publish never fails the
mutation.

Code with no tRPC response (a webhook, a workflow) calls `realtime.publish`
on the same channels.

## Consequences

- Data reaches a client one way. A subscriber to a channel it should not see
  learns only that something changed.
- A lost message costs staleness until the next refetch, never a wrong
  record.
- Every change costs a refetch per subscribed client, and nothing debounces
  it.
- A mutation that registers the wrong channel, or none, leaves other clients
  stale with no error.
- The client rebuilds tRPC's query key by hand (a `FIXME` in
  `services/api/src/links.ts`). A change to that key shape breaks
  invalidation silently.
- Three call sites publish outside the middleware: the moderation webhook,
  `resolveModeration` and `notifyExportChanged`.
