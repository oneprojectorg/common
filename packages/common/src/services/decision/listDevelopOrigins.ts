import type { User } from '@op/supabase/lib';

import { UnauthorizedError } from '../../utils';
import { assertUserByAuthId } from '../assert';
import { listPhaseProposals } from './listPhaseProposals';
import type {
  DevelopOriginList,
  ListDevelopOriginsInput,
} from './schemas/developOrigins';

/**
 * The origins a developed entry can be made from: the submitted proposals of
 * the given earlier phases, all of them or only those the caller is assigned
 * to review there. An origin is a proposal of an earlier phase that an entry
 * is, or can be, developed from.
 *
 * Gated by decisions READ or ADMIN on the instance, which `listPhaseProposals`
 * asserts, and nothing else: no Develop Proposals or Review check and no check
 * on the instance's phase, because the client names the phases and the list
 * shows only what `proposal.list` already would. Develop Proposals is asserted
 * where an entry is created, in `createDevelopedProposal`.
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

/** The caller's own profile, which review assignments are made to. */
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
