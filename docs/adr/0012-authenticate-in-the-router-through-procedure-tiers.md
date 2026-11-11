# 0012. Authenticate in the router through procedure tiers

Date: 2026-11-11

## Status

Accepted

## Context

Which kind of caller an endpoint accepts has to be settled before any
business logic runs. Identity comes from a cookie or bearer token on the
HTTP request, which a workflow or SMS handler does not have, so a service
that read the session could not be called from either. This records what
`services/api/src/trpcFactory.ts` already does.

In scope: who is calling, and whether that kind of caller may reach the
procedure. What the caller may do to a record is
[0013](./0013-authorize-in-the-service-layer-with-access-zones.md).

## Decision

We will authenticate in the router, by building every procedure from one of
four tiers. A procedure never checks the session itself.

| Tier | Accepts |
| --- | --- |
| `openProcedure` | anyone; `ctx.user` is the caller or `null` |
| `authenticatedProcedure` | any session, including an anonymous one |
| `authenticatedConfirmedProcedure` | a signed-in user with a confirmed email |
| `networkAuthenticatedProcedure` | a confirmed user who is a network member (a `@oneproject.org` or allow-listed address) |

Every tier also applies the rate limit (10 requests per 10 seconds,
overridable per procedure) and analytics.

The first two tiers verify the JWT locally against the JWKS. The confirmed
tiers load the user record, because the token alone does not prove a
confirmed email or network membership.

A rejected caller gets an `AccessTierError`: 401 with no session, 403
otherwise.

Platform admin procedures are the exception. They apply the rate limit and
`withAuthenticatedPlatformAdmin` to `commonProcedure` by hand.

The router passes `ctx.user` to the service as an argument.

## Consequences

- The first line of a procedure states who may call it.
- A caller with no HTTP request authenticates its own way and calls the same
  service: the SMS handler resolves a phone number to an `authUserId`.
- A tier says nothing about a record. A `networkAuthenticatedProcedure`
  whose service makes no permission check is open to every network member.
- A platform admin procedure can drop the rate limit or the admin check
  without a type error. A fifth tier would close that.
- Server-side calls and the E2E suite skip the rate limit.
- Nothing checks the choice of tier. About 120 of 200 procedures use
  `networkAuthenticatedProcedure`; a public one has to opt down on purpose.
