/**
 * Whether the process's first phase has begun.
 *
 * Phase start/end dates are stored as absolute UTC instants (the author's local
 * midnight on the chosen day, converted via `Date.toISOString()` — see
 * ProcessBuilder's `formatDateValue`). The server advances phases by comparing
 * those instants directly against `now` in UTC (see `transitionMonitor.ts`:
 * `lte(scheduledDate, new Date().toISOString())`), so we mirror that here with a
 * plain absolute-instant `>=` — no local-timezone reinterpretation.
 *
 * A missing or unparseable start date counts as started, so CTAs/toggles stay
 * visible by default rather than being hidden by bad data.
 */
export function hasFirstPhaseStarted(
  phases: { startDate?: string }[] | undefined,
): boolean {
  const start = phases?.[0]?.startDate;
  if (!start) {
    return true;
  }
  const parsed = new Date(start);
  if (Number.isNaN(parsed.getTime())) {
    return true;
  }
  return new Date() >= parsed;
}
