# 0012. Authenticate at the interface and pass a verified identity down

Date: 2026-11-11

## Status

Accepted

## Context

The system is reached through more than one interface: the HTTP API, inbound
SMS, webhooks. Each proves identity its own way (a session cookie or bearer
token, a phone number, a signature), so a service that read the session
itself could serve only one of them. This records what the code already
does.

In scope: who is calling, and where that is established. What the caller may
do to a record is
[0013](./0013-authorize-in-the-service-layer-with-access-zones.md).

## Decision

We will authenticate at the interface. Each interface verifies the caller by
its own means and passes the verified identity to the service as an
argument. A service never reads a session, token or header; it trusts the
`user` it is given and authorizes from there.

The HTTP API authenticates through procedure tiers in
`services/api/src/trpcFactory.ts`. Every procedure is built from one, and
never checks the session itself:

| Tier | Accepts |
| --- | --- |
| `openProcedure` | anyone; `ctx.user` is the caller or `null` |
| `authenticatedProcedure` | any session, including an anonymous one |
| `authenticatedConfirmedProcedure` | a signed-in user with a confirmed email |
| `networkAuthenticatedProcedure` | a confirmed user who is a network member |

A rejected caller gets 401 with no session and 403 otherwise.

The SMS interface resolves the sender's phone number to a user and passes
that user to the same services.

A new interface follows the same rule: verify at the edge, pass the identity
down.

## Consequences

- A service works behind any interface, and is tested by passing a `user`.
- Authentication says nothing about a record. An interface that admits a
  caller relies on the service to check what that caller may do.
- Each interface owns its own proof of identity, so a weak one weakens every
  service behind it.
- Nothing checks the choice of tier. About 120 of 200 procedures use
  `networkAuthenticatedProcedure`; a public one has to opt down on purpose.
- Platform admin procedures sit outside the four tiers and assemble their
  checks by hand. A fifth tier would close that.
