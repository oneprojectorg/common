import { db, eq } from '@op/db/client';
import { processInstances } from '@op/db/schema';

import { CommonError } from '../../utils';
import { deleteStorageObject } from '../../utils/deleteStorageObject';
import { invalidateDecisionInstance } from './decisionCache';
import type { DecisionInstanceData } from './schemas/instanceData';

/**
 * Persists a phase's hero image path into `instanceData.phases[i].heroImage`
 * and runs the shared post-write cleanup (cache bust + best-effort delete of
 * the replaced object). Writes `instanceData` directly so sibling phases and
 * transitions are untouched. Callers own the admin assert, phase lookup, and
 * (for uploads) the storage trust-boundary check. Shared by
 * {@link updatePhaseHeroImage} and {@link removePhaseHeroImage}.
 */
export async function applyPhaseHeroImage({
  instanceId,
  instanceData,
  phaseId,
  heroImage,
  previousPath,
}: {
  instanceId: string;
  instanceData: DecisionInstanceData;
  phaseId: string;
  /** New stored path, or '' to clear. */
  heroImage: string;
  /** Prior stored path, deleted from the bucket once the write lands. */
  previousPath?: string;
}): Promise<void> {
  const updatedInstanceData: DecisionInstanceData = {
    ...instanceData,
    phases: instanceData.phases.map((phase) =>
      phase.phaseId === phaseId ? { ...phase, heroImage } : phase,
    ),
  };

  const [updated] = await db
    .update(processInstances)
    .set({ instanceData: updatedInstanceData })
    .where(eq(processInstances.id, instanceId))
    .returning({ id: processInstances.id });
  if (!updated) {
    throw new CommonError('Failed to update decision process instance');
  }

  // Cache bust and dropping the replaced object are independent — run together.
  await Promise.all([
    invalidateDecisionInstance(instanceId),
    previousPath && previousPath !== heroImage
      ? deleteStorageObject({ path: previousPath })
      : Promise.resolve(),
  ]);
}
