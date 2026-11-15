import { db } from '@op/db/client';
import { ProposalRelationshipType, proposalRelationships } from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { NotFoundError, UnauthorizedError, ValidationError } from '../../utils';
import { invalidateProfileUserAccessCache } from '../access';
import { assertDevelopSources } from './assertDevelopSources';
import { getProposalDevelopAccess } from './assertProposalDevelopAccess';
import { getDevelopSourceFilter } from './developOriginScope';
import { insertProposalDraft } from './insertProposalDraft';
import type { ProposalDataInput } from './proposalDataSchema';
import { resolveProposalDraftInputs } from './proposalDraftInputs';
import { resolveProposalTemplate } from './resolveProposalTemplate';
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
 * transaction as the draft. The draft takes the phase's `formSchemaId` as its
 * form, so it opens with the entry form instead of the instance template.
 *
 * A caller who is not an admin may develop only the origins assigned to them.
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
  const developPhaseId = instance.currentStateId;

  const {
    phase: currentPhase,
    isAdmin,
    canDevelop,
  } = await getProposalDevelopAccess({
    instance: {
      profileId: instance.profileId,
      instanceData: { phases },
    },
    phaseId: developPhaseId,
    user: { id: authUserId },
  });

  if (!canDevelop) {
    throw new UnauthorizedError('Not authorized');
  }

  const sourceProposalIds = [...new Set(data.sourceProposalIds)];

  const formSchemaId = currentPhase.formSchemaId ?? null;

  const [, , draftInputs] = await Promise.all([
    getDevelopSourceFilter({
      processInstanceId: instance.id,
      phases,
      developPhaseId,
      isAdmin,
      user: { id: authUserId },
    }).then((restrictTo) =>
      assertDevelopSources({ instance, sourceProposalIds, restrictTo }),
    ),
    // Refuse a pointer to a missing or malformed row before the insert; the
    // FK would only catch a missing one, and as a raw database error.
    formSchemaId
      ? resolveProposalTemplate(null, null, formSchemaId)
      : undefined,
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
      formSchemaId,
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
