import { and, db, eq, inArray, ne } from '@op/db/client';
import {
  ProposalRelationshipType,
  ProposalStatus,
  proposalRelationships,
  proposals,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { NotFoundError, ValidationError } from '../../utils';
import {
  getCurrentProfileId,
  invalidateProfileUserAccessCache,
} from '../access';
import { assertGlobalRole } from '../assert';
import { assertProposalDevelopAccess } from './assertProposalDevelopAccess';
import { withBoundaryCategoryLabel } from './boundaryCategory';
import { getProposalIdsForPhase } from './getProposalsForPhase';
import { insertProposalDraft } from './insertProposalDraft';
import { activeProposalPredicate } from './phaseEligibility';
import {
  type ProposalDataInput,
  parseProposalData,
} from './proposalDataSchema';
import {
  extractTitleFromProposalData,
  getCategoryTermIds,
} from './proposalDraftInputs';
import { notSuperseded } from './proposalSupersession';
import {
  type PhaseInstanceData,
  getInstancePhases,
} from './schemas/instanceData';
import { isDevelopPhase } from './utils/phaseSettings';

export interface CreateDevelopedProposalInput {
  processInstanceId: string;
  sourceProposalIds: string[];
  proposalData: ProposalDataInput;
  attachmentIds?: string[];
}

/**
 * Creates a draft proposal in a develop phase, developed from proposals of
 * the previous phase. Writes one `developed` edge per source in the same
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

  const phases = getInstancePhases(instance.instanceData);
  const currentPhaseIndex = phases.findIndex(
    (phase) => phase.phaseId === instance.currentStateId,
  );
  const currentPhase = phases[currentPhaseIndex];

  if (!currentPhase || !isDevelopPhase(currentPhase)) {
    throw new ValidationError(
      'Developed proposals can only be created in a develop phase',
    );
  }

  await assertProposalDevelopAccess({
    instance: {
      profileId: instance.profileId,
      instanceData: { phases: [...phases] },
    },
    phaseId: currentPhase.phaseId,
    user: { id: authUserId },
  });

  const sourceProposalIds = await assertDevelopSources({
    instance,
    previousPhase: phases[currentPhaseIndex - 1],
    sourceProposalIds: data.sourceProposalIds,
  });

  // Captured at creation, like `createProposal`: the flag sticks through
  // submission even if the phase rule changes.
  const defaultHidden =
    currentPhase.rules?.proposals?.defaults?.hidden === true;

  const parsedProposalData = parseProposalData(data.proposalData);
  const proposalTitle = extractTitleFromProposalData(data.proposalData);

  const manualCategoryLabels = [...new Set(parsedProposalData.category)];
  const categoryLabels = instance.profileId
    ? await withBoundaryCategoryLabel(manualCategoryLabels, data.proposalData, {
        profileId: instance.profileId,
      })
    : manualCategoryLabels;
  const categoryTermIds = await getCategoryTermIds(categoryLabels);

  const [profileId, adminRole] = await Promise.all([
    getCurrentProfileId(authUserId),
    assertGlobalRole('Admin'),
  ]);

  const createdProposal = await db.transaction(async (tx) => {
    const proposal = await insertProposalDraft({
      tx,
      user,
      processInstanceId: instance.id,
      proposalData: data.proposalData,
      attachmentIds: data.attachmentIds,
      proposalTitle,
      categoryLabels,
      categoryTermIds,
      submittedByProfileId: profileId,
      adminRoleId: adminRole.id,
      defaultHidden,
      formSchemaId: currentPhase.formSchemaId ?? null,
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
 * Every source must be a live, non-draft proposal of this instance that was
 * a member of the previous phase and has not been merged into another.
 * Returns the source ids in the order given.
 */
async function assertDevelopSources({
  instance,
  previousPhase,
  sourceProposalIds,
}: {
  instance: {
    id: string;
    instanceData: unknown;
    currentStateId: string | null;
  };
  previousPhase: PhaseInstanceData | undefined;
  sourceProposalIds: string[];
}): Promise<string[]> {
  if (sourceProposalIds.length === 0) {
    throw new ValidationError('Choose at least one source proposal');
  }

  const uniqueIds = new Set(sourceProposalIds);
  if (uniqueIds.size !== sourceProposalIds.length) {
    const duplicateIds = sourceProposalIds.filter(
      (id, index) => sourceProposalIds.indexOf(id) !== index,
    );
    throw new ValidationError(
      `Source proposals are listed more than once: ${[...new Set(duplicateIds)].join(', ')}`,
    );
  }

  if (!previousPhase) {
    throw new ValidationError(
      'Developed proposals need a previous phase to develop from',
    );
  }

  const [previousPhaseIds, validRows] = await Promise.all([
    getProposalIdsForPhase({ instance, phaseId: previousPhase.phaseId }),
    db
      .select({ id: proposals.id })
      .from(proposals)
      .where(
        and(
          inArray(proposals.id, sourceProposalIds),
          eq(proposals.processInstanceId, instance.id),
          // Never drafts, deleted or moderation-detached proposals, and never
          // one merged away.
          ne(proposals.status, ProposalStatus.DRAFT),
          activeProposalPredicate(proposals),
          notSuperseded({
            proposalId: proposals.id,
            processInstanceId: instance.id,
          }),
        ),
      ),
  ]);

  const inPreviousPhase = new Set(previousPhaseIds);
  const validIds = new Set(
    validRows.map((row) => row.id).filter((id) => inPreviousPhase.has(id)),
  );
  const invalidIds = sourceProposalIds.filter((id) => !validIds.has(id));

  if (invalidIds.length > 0) {
    throw new ValidationError(
      `These proposals cannot be developed in this phase: ${invalidIds.join(', ')}`,
    );
  }

  return sourceProposalIds;
}
