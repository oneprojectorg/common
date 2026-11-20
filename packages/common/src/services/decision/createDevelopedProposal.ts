import { db } from '@op/db/client';
import { ProposalRelationshipType, proposalRelationships } from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { NotFoundError, ValidationError } from '../../utils';
import { invalidateProfileUserAccessCache } from '../access';
import { addDevelopedEntryCoauthors } from './addDevelopedEntryCoauthors';
import { assertDevelopSources } from './assertDevelopSources';
import { assertProposalDevelopAccess } from './assertProposalDevelopAccess';
import { assertDevelopUnlocked } from './developLock';
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
 * transaction as the draft. With prefill mappings on the phase, the draft
 * starts from its sources (`getDevelopedEntryPrefill`). The reviewers
 * assigned to the sources become co-authors (`addDevelopedEntryCoauthors`).
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
  await assertDevelopUnlocked({
    instance: { ...instance, phases },
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

  const { createdProposal, coauthorAuthUserIds } = await db.transaction(
    async (tx) => {
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

      const coauthorAuthUserIds = await addDevelopedEntryCoauthors({
        tx,
        processInstanceId: instance.id,
        sourceProposalIds,
        proposalProfileId: proposal.profileId,
        authorAuthUserId: authUserId,
      });

      return { createdProposal: proposal, coauthorAuthUserIds };
    },
  );

  await Promise.all([
    // The cached `user` entries of the author and co-authors predate these memberships.
    ...[authUserId, ...coauthorAuthUserIds].map((memberAuthUserId) =>
      invalidateProfileUserAccessCache({
        authUserId: memberAuthUserId,
        profileId: createdProposal.profileId,
      }),
    ),
    seedDevelopedEntryDocument({
      collaborationDocId: parseProposalData(createdProposal.proposalData)
        .collaborationDocId,
      documentUpdate: prefill?.documentUpdate ?? null,
    }),
  ]);

  return createdProposal;
};

/** The mapped system fields replace the caller's, as if the author typed them. */
function withEntryPrefill({
  proposalData,
  prefill,
}: {
  proposalData: ProposalDataInput;
  prefill: DevelopedEntryPrefill | null;
}): ProposalDataInput {
  return prefill ? { ...proposalData, ...prefill.proposalData } : proposalData;
}
