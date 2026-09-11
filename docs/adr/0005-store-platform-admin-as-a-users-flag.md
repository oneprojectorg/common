# 0005. Store platform admin as a flag on the users row

Date: 2026-09-09

## Status

Accepted

## Context

Platform admin — `/admin` plus every `withAuthenticatedPlatformAdmin`
procedure — was a hardcoded set of eight emails in `@op/core`, so every grant
was a code change and a deploy across two Vercel projects (PR #2007).

## Decision

- Platform admin is `users.is_platform_admin`, a `NOT NULL DEFAULT false`
  boolean keyed by `auth_user_id` — the Django `is_superuser` pattern.
- The app only reads it: `isPlatformAdmin({ authUserId })` in `@op/common` is
  one uncached select, for both the API gate and the `/admin` layout.
- Nothing writes it — no procedure, no UI. An operator runs the SQL.

## Consequences

- Minting a superuser needs database access rather than a deploy or a click.
- The org-level `Admin` role stays distinct: one organization, no platform reach.
- No audit trail beyond what the database itself records.
