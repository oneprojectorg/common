import { db, eq } from '@op/db/client';
import { processInstances } from '@op/db/schema';
import { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { CommonError, NotFoundError } from '../../utils';
import { assertInstanceProfileAccess } from '../access';
import type {
  LatestThemeAnalysisResponse,
  ThemeAnalysisScope,
} from './schemas/themeAnalysis';
import { readLatestThemeAnalysis } from './themes';

/**
 * Reads the most recent finished theme analysis of a scope.
 *
 * This is what the "View themes" button opens. The scheduled refresh writes a
 * snapshot whenever an instance's proposals change, and a manual run writes
 * the same snapshot when it finishes, so for a decision that has seen a
 * proposal since the feature shipped there is one waiting and nobody has to
 * sit through the model.
 *
 * Authorization is the same boundary the request and the status read apply —
 * `decisions: ADMIN` on the profile that owns the instance — and it runs
 * before the cache is touched. Unlike the status read there is no record owner
 * to check against: the snapshot belongs to the instance, and every admin of
 * the decision may open it.
 *
 * @returns The snapshot, or `{ status: 'not_found' }` when none is stored.
 * @throws CommonError when the cache did not answer. The client offers a fresh
 *   run on `not_found`, and a Redis timeout should not read as "nothing here".
 * @throws NotFoundError when the instance does not exist.
 * @throws UnauthorizedError when the caller is not a decision admin.
 */
export const getLatestThemeAnalysis = async ({
  processInstanceId,
  scope,
  user,
}: {
  processInstanceId: string;
  scope: ThemeAnalysisScope;
  user: User;
}): Promise<LatestThemeAnalysisResponse> => {
  const [instance] = await db
    .select({ profileId: processInstances.profileId })
    .from(processInstances)
    .where(eq(processInstances.id, processInstanceId))
    .limit(1);

  if (!instance) {
    throw new NotFoundError('Process instance', processInstanceId);
  }

  // `ownerProfileId` is null for the reason given in `requestThemeAnalysis`:
  // the analysis covers every proposal in scope, so it stays with admins of the
  // decision profile rather than with org-level grant holders.
  await assertInstanceProfileAccess({
    user,
    instance: { profileId: instance.profileId, ownerProfileId: null },
    profilePermissions: { decisions: permission.ADMIN },
    orgFallbackPermissions: { decisions: permission.ADMIN },
  });

  const read = await readLatestThemeAnalysis({ processInstanceId, scope });

  if (read.status === 'unavailable') {
    throw new CommonError('Could not read the analysis.');
  }

  if (read.status === 'miss') {
    return { status: 'not_found' as const };
  }

  return read.snapshot;
};
