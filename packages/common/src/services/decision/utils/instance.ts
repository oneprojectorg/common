import { NotFoundError } from '../../../utils';

/**
 * Throws NotFoundError when `phaseId` is not configured on the instance's
 * `instanceData.phases`. Use this in routes/services that accept a phaseId
 * from the caller, so an unknown phase fails loudly instead of silently
 * resolving to empty results.
 */
export function assertInstancePhase({
  instance,
  phaseId,
}: {
  instance: { instanceData: { phases?: ReadonlyArray<{ phaseId: string }> } };
  phaseId: string;
}): void {
  const phases = instance.instanceData.phases ?? [];
  if (!phases.some((p) => p.phaseId === phaseId)) {
    throw new NotFoundError('Phase', phaseId);
  }
}
