# 0012. Authenticate in the router through procedure tiers

Date: 2026-11-11

## Status

Accepted

## Context

A request reaches the API from one of four kinds of caller: someone with no
session, an anonymous session, a signed-in user with a confirmed email, and a
member of the network (a `@oneproject.org` address or an allow-listed one).
Which of these a procedure accepts is a property of the endpoint, and it has
to be answered before any business logic runs.

Identity is also a transport concern. It comes from a cookie or a bearer
token on the HTTP request, which a workflow or an SMS handler does not have.
A service that read the session itself could not be called from either.

This ADR records a decision that is already in force in
`services/api/src/trpcFactory.ts`. In scope: who is calling, and whether that
kind of caller may reach the procedure at all. Out of scope: what that caller
may do to a given record, which is authorization and has
[its own ADR](./0013-authorize-in-the-service-layer-with-access-zones.md).

## Decision

We will authenticate in the router, by building every procedure from one of
four tiers. A procedure never checks the session itself.

| Tier | Accepts |
| --- | --- |
| `openProcedure` | anyone; `ctx.user` is the caller or `null` |
| `authenticatedProcedure` | any session, including an anonymous one |
| `authenticatedConfirmedProcedure` | a signed-in user with a confirmed email |
| `networkAuthenticatedProcedure` | a confirmed user who is a network member |

Each tier is a stack of middleware on `commonProcedure`, which adds the
request cache, the realtime channel wrapper and the request logger. Each tier
also adds the rate limit (10 requests per 10 seconds by default, overridable
per procedure) and analytics, so a procedure cannot be authenticated but
unlimited.

`openProcedure` and `authenticatedProcedure` verify the JWT locally against
the JWKS and make no call to the auth server. The two confirmed tiers load
the user record, because a confirmed email and network membership are not
claims we trust from the token alone.

A caller the tier rejects gets an `AccessTierError` carrying the tier the
caller did reach. It maps to 401 when there is no session and 403 otherwise,
so the client can tell "sign in" from "you may not".

Platform administration is the one case outside the four tiers. Those
procedures take `commonProcedure` and apply the rate limit and
`withAuthenticatedPlatformAdmin` by hand.

The router passes `ctx.user` to the service as an argument. The service
trusts that the caller is who `user` says, and nothing else.

## Consequences

- The first line of a procedure states who may call it, and a reviewer reads
  it without opening a middleware.
- A caller with no HTTP request authenticates its own way and then calls the
  same service: the SMS handler resolves a phone number to an `authUserId`
  and passes it in.
- A tier says nothing about a record. A `networkAuthenticatedProcedure` whose
  service makes no permission check is open to every network member.
- The platform admin procedures assemble their stack by hand, so one can drop
  the rate limit or the admin check without a type error. A fifth tier would
  close that.
- The rate limit is skipped for server-side calls and for the E2E suite, so a
  server component that fans out is not throttled by it.
- Choosing a tier is a judgement the type system does not check. Most
  procedures (about 120 of 200) use `networkAuthenticatedProcedure`; a
  procedure meant for the public has to opt down on purpose.
