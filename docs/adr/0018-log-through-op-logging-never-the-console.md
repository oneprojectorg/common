# 0018. Log through `@op/logging`, never the console

Date: 2026-11-11

## Status

Accepted

## Context

A `console.*` line on the server ends up in the host's log stream, where it
has no request context and nobody searches it. In the browser it reaches
nobody. We already investigate production in PostHog, so a log that is not
there does not exist for that purpose. This records the rule in force.

In scope: how code writes a log line, and what it may contain.

## Decision

We will write every log line through `@op/logging`, which ships it to
PostHog.

- Server code imports `logger` from `@op/logging`. Inside a tRPC procedure
  it uses `ctx.logger`, which adds the request context.
- Browser code imports `logger` from `@op/logging/client`. An `error` or
  `warn` also becomes an exception in PostHog Error Tracking.

A caught error is passed under the `error` key:
`logger.error('Export failed', { error })`.

A log line never holds a raw client IP, an email, a token or a request body.
It holds the ids we already store.

## Consequences

- Server and browser logs are in one place, as structured records that can
  be filtered by attribute.
- A log line is tied to its request and, through the PostHog id, to a
  session.
- Logs depend on PostHog. The client logger writes to the console outside
  production only, so a production browser console shows nothing.
- What may be logged is a rule people follow, not one the logger enforces.
