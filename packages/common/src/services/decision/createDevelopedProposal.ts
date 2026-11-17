import { db } from '@op/db/client';
import { ProposalRelationshipType, proposalRelationships } from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { NotFoundError, ValidationError } from '../../utils';
import { invalidateProfileUserAccessCache } from '../access';
import { assertDevelopSources } from './assertDevelopSources';
import { assertProposalDevelopAccess } from './assertProposalDevelopAccess';
import {
  type DevelopedEntryPrefill,
  getDevelopedEntryPrefill,
  seedDevelopedEntryDocument,
} from './developedEntryPrefill';
import { insertProposalDraft } from './insertProposalDraft';
import { getPhases } from './instancePhases';
import {
  type ProposalDataInput,
  parseProposalData,
} from './proposalDataSchema';
import { resolveProposalDraftInputs } from './proposalDraftInputs';

export interface CreateDevelopedProposalInput {
  processInstanceId: string;
  sourceProposalIds: string[];
  proposalData: ProposalDataInput;
  attachmentIds?: string[];
}

/**
 * Creates a draft proposal in a develop phase, developed from proposals of
 * any phase of the instance. Writes one `developed` edge per source in the same
 * transaction as the draft. When the phase has prefill mappings, the draft
 * starts with the mapped title and category, and its collaboration document,
 * created after the commit, with copies of the sources' mapped fragments.
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

  const phases = await getPhases({ instance });

  const currentPhase = await assertProposalDevelopAccess({
    instance: { profileId: instance.profileId, phases },
    phaseId: instance.currentStateId,
    user: { id: authUserId },
  });

  const sourceProposalIds = [...new Set(data.sourceProposalIds)];

  await assertDevelopSources({ instance, sourceProposalIds });

  const prefill = await getDevelopedEntryPrefill({
    instance,
    phases,
    developPhase: currentPhase,
    sourceProposalIds,
    user,
  });
  const proposalData = withEntryPrefill({
    proposalData: data.proposalData,
    prefill,
  });

  const draftInputs = await resolveProposalDraftInputs({
    authUserId,
    instanceProfileId: instance.profileId,
    phase: currentPhase,
    proposalData,
  });

  const createdProposal = await db.transaction(async (tx) => {
    const proposal = await insertProposalDraft({
      tx,
      user,
      processInstanceId: instance.id,
      proposalData,
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

  await Promise.all([
    // The author's cached `user` entry predates this membership.
    invalidateProfileUserAccessCache({
      authUserId,
      profileId: createdProposal.profileId,
    }),
    seedDevelopedEntryDocument({
      collaborationDocId: parseProposalData(createdProposal.proposalData)
        .collaborationDocId,
      documentUpdate: prefill?.documentUpdate ?? null,
    }),
  ]);

  return createdProposal;
};

/**
 * The mapped title and category replace the caller's. The title becomes the
 * entry's name, and the category places the entry before anyone edits it.
 */
function withEntryPrefill({
  proposalData,
  prefill,
}: {
  proposalData: ProposalDataInput;
  prefill: DevelopedEntryPrefill | null;
}): ProposalDataInput {
  if (!prefill) {
    return proposalData;
  }

  return {
    ...proposalData,
    ...(prefill.title ? { title: prefill.title } : {}),
    ...(prefill.category ? { category: prefill.category } : {}),
  };
}
