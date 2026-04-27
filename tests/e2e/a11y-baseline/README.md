# Accessibility baseline

Generated output from `pnpm a11y:baseline`. Drives WCAG 2.1 AA Compliance Sprint targets.

- `report.json` — machine-readable totals + per-route violation summaries (axe-core impact: critical / serious / moderate / minor).
- `report.md` — human-readable summary, top rules, per-route detail.

## Run

Requires the e2e environment up:

```bash
# one-time
pnpm w:e2e supabase:setup
pnpm build:e2e

# each scan
pnpm start:e2e &        # serves apps/app on :4100, apps/api on :4300
pnpm a11y:baseline      # runs the spec, overwrites report.{json,md}
```

The baseline currently covers public + key authenticated routes (home, decisions index, profile index, search, org index + a seeded org page). Add dynamic routes (decision instances, proposals) to `tests/e2e/tests/a11y-baseline.spec.ts` as fixtures get seeded.
