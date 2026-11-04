/**
 * Phase-order navigation over a phase list. Phase order IS the array order
 * (first = initial, last = final) — phases carry no explicit rank. Takes any
 * `{ phases }` source: the server passes a resolved instance, the client its
 * wire `instanceData`. Client-safe: no server-only imports.
 */

export const MAX_PHASES_PER_DECISION = 30;

export interface PhaseSource<Phase extends { phaseId: string }> {
  phases?: readonly Phase[];
}

/** Index of `phaseId` in the instance's phase ordering; `-1` when absent. */
export function getPhaseIndex(
  source: PhaseSource<{ phaseId: string }>,
  phaseId: string,
): number {
  return (source.phases ?? []).findIndex((p) => p.phaseId === phaseId);
}

/**
 * True when `phaseId` sits at or before `referencePhaseId` in the phase
 * ordering. False when either phase is not configured on the instance, so
 * gates using this fail closed on unknown phases.
 */
export function isPhaseAtOrBefore(
  source: PhaseSource<{ phaseId: string }>,
  phaseId: string,
  referencePhaseId: string,
): boolean {
  const target = getPhaseIndex(source, phaseId);
  const reference = getPhaseIndex(source, referencePhaseId);
  return target !== -1 && reference !== -1 && target <= reference;
}

/**
 * The phases strictly before `phaseId` in the ordering, in phase order.
 * Empty when `phaseId` is the first phase or is not configured.
 */
export function getPreviousPhases<Phase extends { phaseId: string }>(
  source: PhaseSource<Phase>,
  phaseId: string,
): Phase[] {
  const index = getPhaseIndex(source, phaseId);
  if (index <= 0) {
    return [];
  }
  return (source.phases ?? []).slice(0, index);
}

/**
 * True when the phase `phaseId` is strictly before `currentStateId` in the
 * phase ordering — i.e. the instance has moved past it, so anything the phase
 * produced is final. False when either phase is not configured on the
 * instance, or when `currentStateId` is unknown, so gates using this fail
 * closed.
 */
export function hasPhaseEnded(
  source: PhaseSource<{ phaseId: string }>,
  phaseId: string,
  currentStateId: string | null | undefined,
): boolean {
  if (!currentStateId) {
    return false;
  }
  const target = getPhaseIndex(source, phaseId);
  const current = getPhaseIndex(source, currentStateId);
  return target !== -1 && current !== -1 && target < current;
}
