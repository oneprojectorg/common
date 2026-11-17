import type { User } from '@op/supabase/lib';

import { UnauthorizedError } from '../../utils';
import { assertUserByAuthId } from '../assert';
import { listPhaseProposals } from './listPhaseProposals';
import type {
  DevelopSourceList,
  ListDevelopSourcesInput,
} from './schemas/developSources';

/**
 * Gated only by the READ check in `listPhaseProposals`: no Develop Proposals,
 * Review or phase check, as Develop Proposals is asserted in
 * `createDevelopedProposal`.
 */
export async function listDevelopSources({
  user,
  processInstanceId,
  phaseIds,
  scope = 'all',
  search,
  categoryIds,
  cursor,
  limit,
}: ListDevelopSourcesInput & { user: User }): Promise<DevelopSourceList> {
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
