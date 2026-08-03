// Direct module import (not the barrel) to stay client-safe.
import { NotFoundError } from '../../../utils/error';

/**
 * Throws NotFoundError when `phaseId` is not configured on the instance's
 * `instanceData.phases`, so an unknown phase fails loudly instead of silently
 * resolving to empty results. Returns the matched phase. Generic/structural so
 * it accepts both domain and API-encoder instance data.
 */
export function assertInstancePhase<Phase extends { phaseId: string }>({
  instance,
  phaseId,
}: {
  instance: { instanceData: { phases?: readonly Phase[] } };
  phaseId: string;
}): Phase {
  const phase = instance.instanceData.phases?.find(
    (p) => p.phaseId === phaseId,
  );
  if (!phase) {
    throw new NotFoundError('Phase', phaseId);
  }
  return phase;
}

/**
 * True when `phaseId` is the instance's current phase. Structural so it accepts
 * both domain and API-encoder instance shapes.
 */
export function isInstanceCurrentPhase(
  instance: { currentStateId: string | null },
  phaseId: string,
): boolean {
  return instance.currentStateId != null && instance.currentStateId === phaseId;
}
