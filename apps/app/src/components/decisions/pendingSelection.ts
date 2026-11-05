/**
 * The phase a pending manual selection shortlists from, or `null` when no
 * selection is pending.
 *
 * This is the one client-side reading of `selectionsAreConfirmed`:
 * `DecisionStateRouter` mounts a selection surface for the phase before the
 * current one while the flag is falsy, and `ReviewSummaryAdvanceFooter`'s
 * draft is only consumed while that surface is up. Both callers must agree,
 * so they share this rule.
 */
export function getPendingSelectionSourcePhase<P extends { phaseId: string }>({
  phases,
  currentPhaseId,
  selectionsAreConfirmed,
}: {
  phases: readonly P[] | null | undefined;
  currentPhaseId: string | null | undefined;
  selectionsAreConfirmed: boolean | undefined;
}): P | null {
  if (selectionsAreConfirmed) {
    return null;
  }
  const list = phases ?? [];
  const currentIndex = list.findIndex(
    (phase) => phase.phaseId === currentPhaseId,
  );
  return currentIndex > 0 ? (list[currentIndex - 1] ?? null) : null;
}
