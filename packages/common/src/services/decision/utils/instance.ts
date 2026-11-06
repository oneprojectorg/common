// Direct module import (not the barrel) to stay client-safe.
import { NotFoundError } from '../../../utils/error';

/**
 * An instance whose phases are readable: a server instance with resolved
 * `phases`, or a client wire instance whose `instanceData` carries them.
 */
type PhasedInstance<Phase extends { phaseId: string }> =
  | { phases: readonly Phase[] }
  // TODO: remove this arm and the instanceData read in getPhasesOf once the client reads phases off the instance.
  | {
      phases?: undefined;
      instanceData?: { phases?: readonly Phase[] } | null;
    };

/**
 * Throws NotFoundError when `phaseId` is not configured on the instance, so an
 * unknown phase fails loudly instead of silently resolving to empty results.
 * Returns the matched phase.
 */
export function assertInstancePhase<Phase extends { phaseId: string }>({
  instance,
  phaseId,
}: {
  instance: PhasedInstance<Phase>;
  phaseId: string;
}): Phase {
  const phase = getPhasesOf(instance).find((p) => p.phaseId === phaseId);
  if (!phase) {
    throw new NotFoundError('Phase', phaseId);
  }
  return phase;
}

/**
 * The instance's current phase, or null when it has none configured. Never
 * throws: visibility callers must fail closed rather than break the page.
 */
export function getInstanceCurrentPhase<Phase extends { phaseId: string }>(
  instance: PhasedInstance<Phase> & { currentStateId: string | null },
): Phase | null {
  return (
    getPhasesOf(instance).find((p) =>
      isInstanceCurrentPhase(instance, p.phaseId),
    ) ?? null
  );
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

function getPhasesOf<Phase extends { phaseId: string }>(
  instance: PhasedInstance<Phase>,
): readonly Phase[] {
  if (instance.phases !== undefined) {
    return instance.phases;
  }
  return instance.instanceData?.phases ?? [];
}
