import { db } from '@op/db/client';
import { ProposalRelationshipType } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { checkPermission, permission } from 'access-zones';

import { NotFoundError, UnauthorizedError, ValidationError } from '../../utils';
import { getProfileAccessRoles, getProfileAccessUser } from '../access';
import { assertProposalDevelopAccess } from './assertProposalDevelopAccess';
import { assertDevelopUnlocked } from './developLock';
import { getPhases } from './instancePhases';

/**
 * Asserts the caller may develop in the current phase, is not held by the
 * develop lock (`assertDevelopUnlocked`) and authors this developed proposal
 * or is an admin of the decision.
 */
export async function assertDevelopedProposalStatusAccess<
  TInstance extends {
    id: string;
    profileId: string | null;
    currentStateId: string | null;
    instanceData: unknown;
  },
>({
  proposal,
  instance,
  user,
}: {
  proposal: { id: string; profileId: string };
  instance: TInstance | null;
  user: Pick<User, 'id'>;
}): Promise<TInstance & { profileId: string }> {
  if (!instance?.profileId) {
    throw new NotFoundError('Decision profile');
  }

  const currentPhaseId = instance.currentStateId;

  if (!currentPhaseId) {
    throw new ValidationError('Invalid phase in process instance');
  }

  const phases = await getPhases({ instance });

  const [, developedEdge, author] = await Promise.all([
    assertProposalDevelopAccess({
      instance: { profileId: instance.profileId, phases },
      phaseId: currentPhaseId,
      user: { id: user.id },
    }),
    db.query.proposalRelationships.findFirst({
      where: {
        targetProposalId: proposal.id,
        relationshipType: ProposalRelationshipType.DEVELOPED,
        deletedAt: { isNull: true },
      },
      columns: { id: true },
    }),
    getProfileAccessUser({
      user: { id: user.id },
      profileId: proposal.profileId,
    }),
  ]);

  if (!developedEdge) {
    throw new ValidationError('This proposal was not developed from another');
  }

  // An author holds a membership on the proposal's own profile.
  if (!author) {
    // `assertProposalDevelopAccess` already loaded these roles in this request.
    const instanceRoles = await getProfileAccessRoles({
      user: { id: user.id },
      profileId: instance.profileId,
    });

    if (
      !checkPermission(
        [{ profile: permission.ADMIN }, { decisions: permission.ADMIN }],
        instanceRoles,
      )
    ) {
      throw new UnauthorizedError(
        'Only an author of this proposal or an admin of the decision can change its status',
      );
    }
  }

  await assertDevelopUnlocked({ instance: { ...instance, phases }, user });

  return { ...instance, profileId: instance.profileId };
}
