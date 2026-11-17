import { db } from '@op/db/client';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { UnauthorizedError } from '../../utils';
import { assertInstanceProfileAccess } from '../access';
import { assertUserByAuthId } from '../assert';
import { getDevelopedProposalsBySource } from './getDevelopedProposalsBySource';
import { listPhaseProposals } from './listPhaseProposals';
import {
  type ProposalReadContext,
  getProposalReadContext,
} from './proposalVisibility';
import type {
  DevelopSourceList,
  ListDevelopSourcesInput,
} from './schemas/developSources';

/**
 * Gated only by the READ check in `listPhaseProposals`: no Develop Proposals,
 * Review or phase check, as Develop Proposals is asserted in
 * `createDevelopedProposal`.
 *
 * Each source carries the entries developed from it that the caller may read.
 * Added here, not in `listPhaseProposals`, so the review list stays as it is.
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

  const page = await listPhaseProposals({
    processInstanceId,
    phaseIds,
    assignedToProfileId,
    search,
    categoryIds,
    cursor,
    limit,
    user,
  });

  if (page.items.length === 0) {
    return { ...page, items: [] };
  }

  const developedBySource = await getDevelopedProposalsBySource({
    processInstanceId,
    sourceProposalIds: page.items.map((item) => item.id),
    readContext: await getReadContext({ processInstanceId, user }),
  });

  return {
    ...page,
    items: page.items.map((item) => ({
      ...item,
      developedProposals: developedBySource.get(item.id) ?? [],
    })),
  };
}

/**
 * The same assert `resolveProposalListScope` makes, so it cannot reject a
 * caller the list let through; its roles decide the instance-admin arm.
 */
async function getReadContext({
  processInstanceId,
  user,
}: {
  processInstanceId: string;
  user: User;
}): Promise<ProposalReadContext> {
  const instance = await db.query.processInstances.findFirst({
    where: { id: processInstanceId },
    columns: { profileId: true, ownerProfileId: true },
  });
  if (!instance) {
    throw new UnauthorizedError('User does not have access to this process');
  }

  const decisionRoles = await assertInstanceProfileAccess({
    user,
    instance,
    profilePermissions: [
      { decisions: permission.ADMIN },
      { decisions: permission.READ },
    ],
    orgFallbackPermissions: [
      { decisions: permission.ADMIN },
      { decisions: permission.READ },
    ],
  });

  return getProposalReadContext({ user, decisionRoles });
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
