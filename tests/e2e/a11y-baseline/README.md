# Accessibility baseline

Generated output from `pnpm a11y:baseline`. Tracks WCAG 2.1 AA Compliance Sprint progress.

The scan runs axe-core on every committed route and matches each violation against a committed list of **known violations**. CI fails on any violation not on the list, and on any list entry that no longer fires. Each entry is debt to drive to zero — the list is a punch-list, not an allow-list.

- `known-violations.json` — committed. The source of truth. Identity-keyed list of `(rule, route, fingerprint)` tuples plus metadata (impact, snippet, WCAG criteria) for human review.
- `report.json` — gitignored. Full per-node detail (axe selectors, html, screenshot paths). Useful for local triage; churns every run because of seeded UUIDs and React Aria autogen IDs.
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
pnpm a11y:baseline      # scans, compares against known-violations.json, fails on mismatch
```

## How a scan compares against the list

For each violation, axe gives a CSS selector. The spec walks the DOM up from the matched node to a stable anchor (in priority order: `data-testid`, `role`, semantic landmark, heading text), then describes the path from that anchor down using tag names + `:nth-of-type`. The result is the **fingerprint** — stable across React Aria autogen IDs, generated CSS classes, and (mostly) locale changes.

Identity tuple: `(rule, route, fingerprint)`. The route is the placeholder form (`/en/org/{slug}`) so seed-data churn doesn't break matches.

After the scan:

- **New** = violation seen, not in `known-violations.json` → **CI fails**, listing rule, route, fingerprint, and snippet
- **Resolved** = list entry didn't fire → **CI fails**, asking you to delete the entry
- **Match** = both sets equal → CI passes

## Updating the list

When your PR introduces a new violation:

1. Run `pnpm a11y:baseline` locally to see the failure
2. Either fix the violation, or
3. Open `known-violations.json`, add an entry for the new violation (copy rule, route, fingerprint, snippet from the test output), commit it in the same PR

When your PR fixes a violation:

1. The list entry no longer fires → CI tells you which entry to delete
2. Delete the entry from `known-violations.json`, commit it in the same PR

## Reseeding the list

If you intentionally rewrite the baseline (e.g. big refactor that legitimately moves many fingerprints), regenerate the file:

```bash
pnpm a11y:seed       # writes known-violations.json from the current scan
git diff tests/e2e/a11y-baseline/known-violations.json   # sanity-check the delta
```

This bypasses comparison and overwrites the committed list. Use sparingly — every entry should have an explicit reason to exist.

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
