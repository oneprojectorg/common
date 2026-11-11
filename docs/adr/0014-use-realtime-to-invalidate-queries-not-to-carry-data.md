# 0014. Use realtime to invalidate queries, not to carry data

Date: 2026-11-11

## Status

Accepted

## Context

Several people work on the same decision at once: proposals arrive, reviews
are submitted, votes are counted. A screen that shows any of it has to update
without a reload.

Pushing the changed record over the socket is the obvious design, and it
gives every piece of data two paths to the client. The pushed copy skips the
procedure's tier, the service's permission check and the output encoder, so
each of those has to be rebuilt for the channel, and a subscriber sees
whatever the publisher chose to send.

This ADR records a decision that is already in force. In scope: how a change
on the server reaches other clients. Out of scope: the realtime provider
(`services/realtime`), presence, and collaborative document editing, which
has its own transport.

## Decision

We will send only a signal over realtime. A message names a channel and the
mutation that caused it; it carries no record. A client that receives one
invalidates the queries bound to that channel and refetches them through
tRPC.

Channels are built by the `Channels` helpers in `@op/common`
(`packages/common/src/realtime/channels`) and are named `scope` or
`scope:id`. A router declares them on the context:

- a query calls `ctx.registerQueryChannels([...])` with the channels whose
  changes make its result stale;
- a mutation calls `ctx.registerMutationChannels([...])` with the channels it
  changed.

The `withChannelMeta` middleware does the rest. It returns the channels with
the response and, for a mutation, publishes to them after the response is
sent, tagged with the request id. The client link unwraps the response and
records each query's channels in a registry. The app subscribes to those
channels and, on a message, invalidates the queries registered against that
channel. The client that made the mutation invalidates from the response
itself, and skips the message that echoes its own request id.

Publishing is best effort: a three-second timeout, one retry, and a failure
counted on the `realtime.publish.failures` metric. A failed publish never
fails the mutation.

Code with no tRPC response to attach to — a webhook, a workflow — publishes
to the same channels directly through `realtime.publish`.

## Consequences

- Data reaches a client one way. Authorization and encoding are written once,
  and a subscriber to a channel it should not see learns only that something
  changed.
- A lost message costs staleness until the next refetch, never a wrong
  record.
- Every change costs a refetch per subscribed client. A busy channel with
  many viewers multiplies load on the API, and nothing debounces it yet.
- A mutation that registers the wrong channel, or none, leaves other clients
  stale with no error. Nothing checks a mutation's channels against the
  queries that read what it wrote.
- The client maps a channel to queries by rebuilding tRPC's query key by
  hand (a `FIXME` in `services/api/src/links.ts`). A change to that key shape
  in tRPC breaks invalidation silently.
- Three call sites publish outside the middleware (the moderation webhook,
  `resolveModeration` and `notifyExportChanged`), so the channel list is not
  all in routers.
