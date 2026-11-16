import type { User } from '@op/supabase/lib';

import { UnauthorizedError } from '../../utils';
import { assertUserByAuthId } from '../assert';
import { listPhaseProposals } from './listPhaseProposals';
import type {
  DevelopOriginList,
  ListDevelopOriginsInput,
} from './schemas/developOrigins';

/**
 * Gated only by the READ check in `listPhaseProposals`: no Develop Proposals,
 * Review or phase check, as Develop Proposals is asserted in
 * `createDevelopedProposal`.
 */
export async function listDevelopOrigins({
  user,
  processInstanceId,
  phaseIds,
  scope = 'all',
  search,
  categoryIds,
  cursor,
  limit,
}: ListDevelopOriginsInput & { user: User }): Promise<DevelopOriginList> {
  const assignedToProfileId =
    scope === 'assigned' ? await getCallerProfileId(user) : undefined;

  return await listPhaseProposals({
    processInstanceId,
    phaseIds,
    assignedToProfileId,
    search,
    categoryIds,
    cursor,
    limit,
    user,
  });
}

async function getCallerProfileId(user: User): Promise<string> {
  const { profileId } = await assertUserByAuthId(
    user.id,
    new UnauthorizedError('User must have an active profile'),
  );
  if (!profileId) {
    throw new UnauthorizedError('User must have an active profile');
  }
  return profileId;
}
