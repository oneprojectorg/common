# Accessibility baseline

Generated output from `pnpm a11y:baseline`. Drives WCAG 2.1 AA Compliance Sprint targets.

- `summary.json` — committed. Stable per-route counts and per-rule occurrences for PR-vs-base diffing. No UUIDs, no per-node detail.
- `report.json` — gitignored. Full per-node detail (selectors, html snippets, screenshot paths, axe `failureSummary`). Useful for local triage; churns every run because of seeded UUIDs and React Aria autogen ids.
- `report.md` — gitignored. Human-readable summary, top rules, per-route detail with embedded screenshots when run locally.
- `screenshots/` — gitignored, **local-only**. PNG per visible violation node, organized by stable route slug. CI skips screenshot capture (`process.env.CI`) to keep artifacts small and the scan fast — devs running `pnpm a11y:baseline` locally get the visual previews.

## Run

Requires the e2e environment up:

```bash
# one-time
pnpm w:e2e supabase:setup
pnpm build:e2e

# each scan
pnpm start:e2e &        # serves apps/app on :4100, apps/api on :4300
pnpm a11y:baseline      # runs the spec, overwrites summary.json + report.{json,md} (+ screenshots/ locally)
```

## Routes

Currently scans 16 routes (see `PUBLIC_ROUTES`, `STATIC_AUTH_ROUTES`, and `seedDynamicRoutes` in `tests/e2e/tests/a11y-baseline.spec.ts`):

- 3 public — login, privacy, terms
- 6 static authenticated — home, decisions index, profile index, search, org index, 404
- 7 dynamic authenticated (seeded inline) — org page, org relationships, user profile, decision detail/editor, proposal view/editor

## Known gaps

These need follow-up work outside this PR:

- Modal/overlay states (need post-interaction "soft-record" approach)
- Form-validation error states (same)
- Onboarding `/en/start` (fixture user is already onboarded)
- App-admin routes (`/en/admin*` — fixture user is org-admin only)
- Reviews route (`/en/decisions/{slug}/reviews/{reviewId}` — no review fixture helper yet)
- Locale variants (`/pt`, `/es` etc.)
- Phase-date determinism (seed schema dates from `Date.now()`, so the active decision phase drifts on a 7-day cycle and can shift visible affordances)
