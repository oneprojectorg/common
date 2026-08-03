/**
 * Phase-order navigation over `instanceData.phases`. Phase order IS the array
 * order (first = initial, last = final) — phases carry no explicit rank.
 * Generic/structural like `assertInstancePhase`, so domain instance data and
 * the API-encoder shape both pass. Client-safe: no server-only imports.
 */

interface PhaseOrderInstanceData<Phase extends { phaseId: string }> {
  phases?: readonly Phase[];
}

/** Index of `phaseId` in the instance's phase ordering; `-1` when absent. */
export function getPhaseIndex(
  instanceData: PhaseOrderInstanceData<{ phaseId: string }>,
  phaseId: string,
): number {
  return (instanceData.phases ?? []).findIndex((p) => p.phaseId === phaseId);
}

/**
 * True when `phaseId` sits at or before `referencePhaseId` in the phase
 * ordering. False when either phase is not configured on the instance, so
 * gates using this fail closed on unknown phases.
 */
export function isPhaseAtOrBefore(
  instanceData: PhaseOrderInstanceData<{ phaseId: string }>,
  phaseId: string,
  referencePhaseId: string,
): boolean {
  const target = getPhaseIndex(instanceData, phaseId);
  const reference = getPhaseIndex(instanceData, referencePhaseId);
  return target !== -1 && reference !== -1 && target <= reference;
}

/**
 * The phases strictly before `phaseId` in the ordering, in phase order.
 * Empty when `phaseId` is the first phase or is not configured.
 */
export function getPreviousPhases<Phase extends { phaseId: string }>(
  instanceData: PhaseOrderInstanceData<Phase>,
  phaseId: string,
): Phase[] {
  const index = getPhaseIndex(instanceData, phaseId);
  if (index <= 0) {
    return [];
  }
  return (instanceData.phases ?? []).slice(0, index);
}
