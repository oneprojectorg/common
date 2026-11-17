import { db } from '@op/db/client';
import { ProposalRelationshipType } from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { NotFoundError, UnauthorizedError, ValidationError } from '../../utils';
import { getProfileAccessUser } from '../access';
import { assertProposalDevelopAccess } from './assertProposalDevelopAccess';
import { getPhases } from './instancePhases';

/** Asserts the caller may develop in the current phase and authors this developed proposal. */
export async function assertDevelopedProposalAuthor<
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
    throw new UnauthorizedError(
      'Only an author of this proposal can change its status',
    );
  }

  return { ...instance, profileId: instance.profileId };
}
