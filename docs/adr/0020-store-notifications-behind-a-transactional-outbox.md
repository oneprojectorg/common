# 0020. Store notifications as outbox, activity, and per-recipient rows

Date: 2026-11-12

## Status

Proposed

## Context

One storage schema must power the activity feeds and the notification
channels that ADR 0004 fans out to. Today nothing stores a notification:
a tRPC procedure calls `inngest.send` directly, so an event emitted
before a rollback still sends, an event emitted after a crash is lost,
and no feed can be read back.

The design follows a prior system built on Datomic, where a dispatcher
replayed the transaction log from a stored cursor, so a crashed consumer
missed nothing. Postgres has no materialized transaction log, so an
outbox table written inside the domain transaction gives the same
guarantee: an event exists if and only if the write committed.

In scope: the tables, their delivery semantics, and their foreign-key
rules. Out of scope: which events notify whom (ADR 0002) and which
channel carries them (ADR 0004).

## Decision

We will store notifications in four tables.

- `event_outbox` — written in the same transaction as the domain write.
  A relay (an Inngest cron) sweeps unsent rows, one sweep at a time, and
  sends each to Inngest with the row `id` as the event id. Delivery is
  at least once; `sent_at` and `attempts` record progress, and sent rows
  are pruned after 30 days.
- `activities` — one row per domain event, created by the workflow
  function. A unique index on `outbox_id` makes replay idempotent. The
  row denormalizes its scopes (actor, owner profile, organization,
  process instance, proposal, post, profile) and carries a `snapshot`
  jsonb for rendering. Each feed scope gets a composite index
  `(scope, created_at desc, id desc)`; shared feeds read this table in
  database order (no JS sorts).
- `notifications` — the per-recipient fan-out, unique on
  `(activity_id, user_id)`, with `category`, `action_required` (stamped
  from the event name), and `seen_at` / `read_at` state. Partial indexes
  serve the unread badge and the needs-action tab.
- `notification_deliveries` — an append-only log of per-channel
  attempts, keyed back from provider webhooks by `provider_message_id`.

One Inngest function per event consumes the outbox row and writes the
remaining three tables:

```mermaid
sequenceDiagram
  participant API as tRPC procedure
  participant PG as Postgres
  participant Relay as Outbox relay (Inngest cron)
  participant IG as Inngest
  participant FN as Notification function
  participant RS as Resend

  API->>PG: domain write + event_outbox insert (one transaction)
  Relay->>PG: sweep where sent_at is null
  Relay->>IG: inngest.send(id = outbox.id)
  Relay->>PG: mark sent_at
  IG->>FN: invoke (retries on failure)
  FN->>PG: insert activity (unique outbox_id)
  FN->>PG: fan out notifications (unique activity_id, user_id)
  FN->>PG: read notification preferences
  FN->>RS: send batch (idempotency keys)
  FN->>PG: append notification_deliveries
  RS-->>API: status webhook
  API->>PG: append notification_deliveries (delivered / bounced)
```

A crash at any arrow replays from the top: every write below
`inngest.send` is idempotent, so a retry re-sends nothing and
re-creates nothing.

Foreign keys follow the schema's delete mechanism: scope columns
(`organization_id`, `process_instance_id`, `proposal_id`, `post_id`)
cascade, so a deleted scope takes its feed with it; `actor_profile_id`
sets null, so a departed actor does not erase events from other
people's feeds; `notifications` and `notification_deliveries` cascade
from their parents.

## Consequences

- A rollback emits nothing, and a crash between any two steps replays
  safely: the `outbox_id` and `(activity_id, user_id)` uniques absorb
  the duplicate rows, and Resend idempotency keys absorb the duplicate
  sends.
- Every feed is one indexed query with a `(created_at, id)` cursor.
- Fan-out writes one row per recipient per event. A process-wide event
  in a large process writes thousands of rows; the write is batched and
  idempotent, but the volume is real.
- The `snapshot` outlives edits to its source, so a feed renders
  history, not current state — and a moderation delete must scrub the
  activities that snapshotted the removed content.
- `thingsYouFollow` needs three events that do not exist yet
  (`proposal/followed`, `profile/followed`, `decision/joined`).
- Reading `activities` for a shared feed must still apply visibility:
  the scope filter alone would unmask anonymous actors and restricted
  proposals through the snapshot.
