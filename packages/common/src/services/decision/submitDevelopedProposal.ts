import { and, db, eq } from '@op/db/client';
import { ProposalRelationshipType, ProposalStatus } from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { NotFoundError, UnauthorizedError, ValidationError } from '../../utils';
import { getProfileAccessUser } from '../access';
import { assertProposalDevelopAccess } from './assertProposalDevelopAccess';
import { finalizeProposalSubmission } from './finalizeProposalSubmission';
import { activeProposalPredicate } from './phaseEligibility';
import { getInstancePhases } from './schemas/instanceData';

export interface SubmitDevelopedProposalInput {
  proposalId: string;
}

/**
 * Submits a developed draft proposal. It is gated by the develop rule, not by
 * the Submit permission or the phase submit rule.
 */
export const submitDevelopedProposal = async ({
  data,
  user,
}: {
  data: SubmitDevelopedProposalInput;
  user: User;
}) => {
  const proposal = await db.query.proposals.findFirst({
    where: {
      RAW: (table) =>
        and(eq(table.id, data.proposalId), activeProposalPredicate(table))!,
    },
    with: {
      processInstance: true,
      profile: true,
    },
  });

  if (!proposal) {
    throw new NotFoundError('Proposal', data.proposalId);
  }

  if (proposal.status !== ProposalStatus.DRAFT) {
    throw new ValidationError(
      'Only draft proposals can be submitted. This proposal has already been submitted.',
    );
  }

  const instance = proposal.processInstance;

  if (!instance?.profileId) {
    throw new NotFoundError('Decision profile');
  }

  const currentPhaseId = instance.currentStateId;

  if (!currentPhaseId) {
    throw new ValidationError('Invalid phase in process instance');
  }

  await assertProposalDevelopAccess({
    instance: {
      profileId: instance.profileId,
      instanceData: { phases: getInstancePhases(instance.instanceData) },
    },
    phaseId: currentPhaseId,
    user: { id: user.id },
  });

  const developedEdge = await db.query.proposalRelationships.findFirst({
    where: {
      targetProposalId: proposal.id,
      relationshipType: ProposalRelationshipType.DEVELOPED,
      deletedAt: { isNull: true },
    },
    columns: { id: true },
  });

  if (!developedEdge) {
    throw new ValidationError('This proposal was not developed from another');
  }

  // An author holds a membership on the proposal's own profile.
  const author = await getProfileAccessUser({
    user: { id: user.id },
    profileId: proposal.profileId,
  });

  if (!author) {
    throw new UnauthorizedError(
      'Only an author of this proposal can submit it',
    );
  }

  return finalizeProposalSubmission({
    proposal,
    instance: {
      id: instance.id,
      processId: instance.processId,
      profileId: instance.profileId,
    },
    instanceData: instance.instanceData,
  });
};
