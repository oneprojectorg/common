import { NotFoundError } from '../../../utils';
import type {
  DecisionInstanceData,
  PhaseInstanceData,
} from '../schemas/instanceData';

/**
 * Throws NotFoundError when `phaseId` is not configured on the instance's
 * `instanceData.phases`. Use this in routes/services that accept a phaseId
 * from the caller, so an unknown phase fails loudly instead of silently
 * resolving to empty results. Returns the matched phase so callers can
 * read its config without a second `find`.
 */
export function assertInstancePhase({
  instance,
  phaseId,
}: {
  instance: { instanceData: DecisionInstanceData };
  phaseId: string;
}): PhaseInstanceData {
  const phase = instance.instanceData.phases.find((p) => p.phaseId === phaseId);
  if (!phase) {
    throw new NotFoundError('Phase', phaseId);
  }
  return phase;
}
