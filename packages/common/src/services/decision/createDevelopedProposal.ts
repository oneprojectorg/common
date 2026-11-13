import { and, db } from '@op/db/client';
import { ProposalRelationshipType, proposalRelationships } from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { NotFoundError, ValidationError } from '../../utils';
import { invalidateProfileUserAccessCache } from '../access';
import { assertProposalDevelopAccess } from './assertProposalDevelopAccess';
import { insertProposalDraft } from './insertProposalDraft';
import {
  activeProposalPredicate,
  phaseEligiblePredicate,
} from './phaseEligibility';
import type { ProposalDataInput } from './proposalDataSchema';
import { resolveProposalDraftInputs } from './proposalDraftInputs';
import { getInstancePhases } from './schemas/instanceData';

export interface CreateDevelopedProposalInput {
  processInstanceId: string;
  sourceProposalIds: string[];
  proposalData: ProposalDataInput;
  attachmentIds?: string[];
}

/**
 * Creates a draft proposal in a develop phase, developed from proposals of
 * any phase of the instance. Writes one `developed` edge per source in the same
 * transaction as the draft.
 */
export const createDevelopedProposal = async ({
  data,
  user,
}: {
  data: CreateDevelopedProposalInput;
  user: User;
}) => {
  const authUserId = user.id;

  const instance = await db.query.processInstances.findFirst({
    where: { id: data.processInstanceId },
  });

  if (!instance) {
    throw new NotFoundError('Process instance', data.processInstanceId);
  }

  if (!instance.currentStateId) {
    throw new ValidationError('Invalid phase in process instance');
  }

  const phases = getInstancePhases(instance.instanceData);

  const currentPhase = await assertProposalDevelopAccess({
    instance: {
      profileId: instance.profileId,
      instanceData: { phases },
    },
    phaseId: instance.currentStateId,
    user: { id: authUserId },
  });

  const sourceProposalIds = [...new Set(data.sourceProposalIds)];

  const [, draftInputs] = await Promise.all([
    assertDevelopSources({ instance, sourceProposalIds }),
    resolveProposalDraftInputs({
      authUserId,
      instanceProfileId: instance.profileId,
      phase: currentPhase,
      proposalData: data.proposalData,
    }),
  ]);

  const createdProposal = await db.transaction(async (tx) => {
    const proposal = await insertProposalDraft({
      tx,
      user,
      processInstanceId: instance.id,
      proposalData: data.proposalData,
      attachmentIds: data.attachmentIds,
      ...draftInputs,
    });

    await tx.insert(proposalRelationships).values(
      sourceProposalIds.map((sourceProposalId) => ({
        processInstanceId: instance.id,
        sourceProposalId,
        targetProposalId: proposal.id,
        relationshipType: ProposalRelationshipType.DEVELOPED,
      })),
    );

    return proposal;
  });

  // The author's cached `user` entry predates this membership.
  await invalidateProfileUserAccessCache({
    authUserId,
    profileId: createdProposal.profileId,
  });

  return createdProposal;
};

/**
 * Every source must be a live, submitted, not rejected, not merged proposal of
 * this instance. Sources may come from any phase.
 */
async function assertDevelopSources({
  instance,
  sourceProposalIds,
}: {
  instance: { id: string };
  sourceProposalIds: string[];
}): Promise<void> {
  if (sourceProposalIds.length === 0) {
    throw new ValidationError('Choose at least one source proposal');
  }

  const validRows = await db.query.proposals.findMany({
    where: {
      id: { in: sourceProposalIds },
      processInstanceId: instance.id,
      RAW: (table) =>
        and(phaseEligiblePredicate(table), activeProposalPredicate(table))!,
    },
    columns: { id: true },
  });

  const validIds = new Set(validRows.map((row) => row.id));
  const invalidIds = sourceProposalIds.filter((id) => !validIds.has(id));

  if (invalidIds.length > 0) {
    throw new ValidationError(
      `These proposals cannot be developed: ${invalidIds.join(', ')}`,
    );
  }
}
