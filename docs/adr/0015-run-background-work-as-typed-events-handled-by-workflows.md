# 0015. Run background work as typed events handled by workflows

Date: 2026-11-11

## Status

Accepted

## Context

Three kinds of work do not fit inside a request: a side effect the caller
should not wait for (an email, a moderation review), a queued job (an
export), and a task that runs long or on a schedule (a nightly phase
transition, a conversation that waits for an SMS reply). Done inline, each
slows the request and is lost when the request dies. This records what the
code already does.

In scope: how background work is started and where it runs. Out of scope:
what each workflow does.

## Decision

We will run all background work on Inngest, started by a typed event. It is
our side-effect mechanism, our job queue and our runner for long tasks; we
add no second queue or worker.

Every event is declared once in `@op/events` (`services/events/src/types.ts`)
as a name and a Zod schema. The Inngest client is typed from that map, so a
send with the wrong name or payload is a compile error.

```ts
await event.send({
  name: Events.proposalExportRequested.name,
  data: { exportId, processInstanceId, userId, format: 'csv' },
});
```

A function in `services/workflows` subscribes by `Events.x.name` and parses
`event.data` with the same schema before it does anything. Queue behaviour
is declared on the function: `concurrency`, `debounce`, `throttle` and
`rateLimit`. A long task is split into `step.run` steps and may wait with
`step.waitForEvent`. A scheduled task subscribes to a `cron` instead of an
event.

An event carries ids, not content. The function reads current state itself,
so a retry or a delay never acts on a stale copy.

A service sends after its transaction commits, never inside it.

## Consequences

- The request returns before the work runs, and Inngest retries a failed
  step.
- One system to operate and one place to look for a stuck job. An Inngest
  outage stops emails, exports and scheduled work together.
- Sender and handler share one schema, checked at compile time and again at
  run time.
- A send that fails after the commit loses the work unless the rows record
  that it is still owed, as invites do with `notifiedAt`.
- A function can run twice, so each step has to be safe to repeat.
- About ten sends still sit in `services/api` rather than in a service, and
  a few routers run analytics through `waitUntil`. Neither is the pattern
  for new code.
