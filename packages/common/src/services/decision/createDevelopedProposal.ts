import { db } from '@op/db/client';
import { ProposalRelationshipType, proposalRelationships } from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { NotFoundError, UnauthorizedError, ValidationError } from '../../utils';
import { invalidateProfileUserAccessCache } from '../access';
import { assertDevelopSources } from './assertDevelopSources';
import { getProposalDevelopAccess } from './assertProposalDevelopAccess';
import {
  getDevelopOriginPhaseId,
  getDevelopSourceFilter,
} from './developOriginScope';
import {
  type DevelopedEntryPrefill,
  getDevelopedEntryPrefill,
  seedDevelopedEntryDocument,
} from './developedEntryPrefill';
import { insertProposalDraft } from './insertProposalDraft';
import {
  type ProposalDataInput,
  normalizeProposalCategories,
  parseProposalData,
} from './proposalDataSchema';
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
 * When the phase has prefill mappings, the draft starts with the mapped title,
 * category and text fields; the text lives in the collaboration document,
 * which is created after the commit (see `getDevelopedEntryPrefill`).
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

  const [prefill] = await Promise.all([
    // The prefill reads the sources, so it waits for their check.
    getDevelopSourceFilter({
      processInstanceId: instance.id,
      phases,
      developPhaseId,
      isAdmin,
      user: { id: authUserId },
    })
      .then((restrictTo) =>
        assertDevelopSources({ instance, sourceProposalIds, restrictTo }),
      )
      .then(() =>
        getDevelopedEntryPrefill({
          instance,
          developPhase: currentPhase,
          originPhaseId: getDevelopOriginPhaseId({ phases, developPhaseId }),
          sourceProposalIds,
          user,
        }),
      ),
    // Refuse a pointer to a missing or malformed row before the insert; the
    // FK would only catch a missing one, and as a raw database error.
    formSchemaId
      ? resolveProposalTemplate(null, null, formSchemaId)
      : undefined,
  ]);

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

  await Promise.all([
    // The author's cached `user` entry predates this membership.
    invalidateProfileUserAccessCache({
      authUserId,
      profileId: createdProposal.profileId,
    }),
    seedDevelopedEntryDocument({
      collaborationDocId: parseProposalData(createdProposal.proposalData)
        .collaborationDocId,
      fragments: prefill?.fragments ?? {},
    }),
  ]);

  return createdProposal;
};

/**
 * The mapped title wins over the title the caller sends; the caller's
 * category wins over the mapped one.
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

  const hasCategory =
    normalizeProposalCategories(proposalData.category).length > 0;

  return {
    ...proposalData,
    ...(prefill.title ? { title: prefill.title } : {}),
    ...(prefill.category && !hasCategory ? { category: prefill.category } : {}),
  };
}
