import { getTipTapClient } from '@op/collab';
import { db, eq } from '@op/db/client';
import { type ProcessInstance, ProposalStatus, proposals } from '@op/db/schema';
import { logger } from '@op/logging';
import { waitUntil } from '@vercel/functions';
import { permission } from 'access-zones';

import { CommonError, NotFoundError, ValidationError } from '../../utils';
import { assertProfileAccess } from '../assert';
import { decisionPermission } from './permissions';
import {
  normalizeLocation,
  normalizeProposalCategories,
  parseProposalData,
} from './proposalDataSchema';
import { syncProposalTitleEmbedding } from './proposalTitleEmbedding';
import { reconcileReviewAssignments } from './reconcileReviewAssignments';
import { hasDecisionBoundaries, resolveBoundary } from './resolveBoundary';
import { resolveProposalTemplate } from './resolveProposalTemplate';
import type { DecisionInstanceData } from './schemas/instanceData';
import { setProposalCategories } from './setProposalCategories';
import { syncProposalProfileLocation } from './syncProposalProfileLocation';
import { templateCollectsLocation } from './templateLocation';
import { checkProposalsAllowed } from './utils/proposal';
import { validateProposalAgainstTemplate } from './validateProposalAgainstTemplate';

export interface SubmitProposalInput {
  proposalId: string;
}

/**
 * Submits a draft proposal, transitioning it to 'submitted' status.
 */
export const submitProposal = async ({
  data,
  authUserId,
}: {
  data: SubmitProposalInput;
  authUserId: string;
}) => {
  // Fetch the proposal with its process instance
  const existingProposal = await db.query.proposals.findFirst({
    where: { id: data.proposalId },
    with: {
      processInstance: true,
      profile: true,
    },
  });

  if (!existingProposal) {
    throw new NotFoundError('Proposal', data.proposalId);
  }

  // Only allow submitting drafts
  if (existingProposal.status !== ProposalStatus.DRAFT) {
    throw new ValidationError(
      'Only draft proposals can be submitted. This proposal has already been submitted.',
    );
  }

  const instance = existingProposal.processInstance as ProcessInstance;

  if (!instance.profileId) {
    throw new NotFoundError('Decision profile');
  }

  // Authorization check - verify user has access to the decision profile
  await assertProfileAccess({
    user: { id: authUserId },
    profileId: instance.profileId,
    permissions: [
      { profile: permission.ADMIN },
      { decisions: decisionPermission.SUBMIT_PROPOSALS },
    ],
  });

  const instanceData = instance.instanceData as DecisionInstanceData;
  const currentPhaseId = instance.currentStateId;

  if (!currentPhaseId) {
    throw new ValidationError('Invalid phase in process instance');
  }

  // Check if proposals are allowed in current phase
  const { allowed, phaseName } = checkProposalsAllowed(
    instanceData.phases,
    currentPhaseId,
  );

  if (!allowed) {
    throw new ValidationError(
      `Proposals are not allowed in the ${phaseName} phase`,
    );
  }

  // Validate proposal data against the proposal template schema
  const proposalTemplate = await resolveProposalTemplate(
    instanceData,
    instance.processId,
  );

  // Stamp the latest TipTap version into proposalData so the history row
  // created by the DB trigger links back to a concrete document revision.
  const parsed = parseProposalData(existingProposal.proposalData);

  // For collab-doc proposals the assembled fragment values are authoritative —
  // stored proposalData may lag the last autosave.
  let assembledData: Record<string, unknown> | null = null;

  if (proposalTemplate) {
    assembledData = await validateProposalAgainstTemplate(
      proposalTemplate,
      existingProposal.proposalData,
      existingProposal.profile.name,
      { profileId: instance.profileId },
    );
  }

  const location =
    normalizeLocation(
      assembledData ? assembledData.location : parsed.location,
    ) ?? null;

  // When the template collects a location, it is mandatory. If boundaries are
  // configured, the pin must fall inside one — the authoritative server-side
  // enforcement of the picker's out-of-area check. When no boundaries exist,
  // any location is valid (the pin can go anywhere).
  if (templateCollectsLocation(proposalTemplate)) {
    if (!location) {
      throw new ValidationError(
        'A project location is required to submit this proposal.',
      );
    }

    const boundary = await resolveBoundary({
      lat: location.lat,
      lng: location.lng,
      profileId: instance.profileId,
    });

    if (
      !boundary &&
      (await hasDecisionBoundaries({ profileId: instance.profileId }))
    ) {
      throw new ValidationError(
        'The selected location is outside the project boundary. Choose a spot within the boundary.',
      );
    }
  }

  // Create a named version snapshot. Best-effort — failures logged, never block.
  if (!parsed.collaborationDocId) {
    throw new ValidationError('Proposal is missing a collaboration document');
  }

  const collaborationDocVersionId = await getTipTapClient()
    .createVersion(parsed.collaborationDocId, { name: 'Submitted' })
    .then((v) => v?.version ?? null)
    .catch((error: unknown) => {
      logger.error('[submitProposal] Failed to create TipTap version', {
        collaborationDocId: parsed.collaborationDocId,
        error,
      });
      return null;
    });

  // The authoritative category set for location templates — manual selections
  // plus the location's council district, already filled into the assembled
  // data. Persisted to BOTH proposalData.category (the read/display source) and
  // the proposalCategories junction (the filter source) so they stay in sync.
  const categoryLabels =
    assembledData && templateCollectsLocation(proposalTemplate)
      ? normalizeProposalCategories(assembledData.category)
      : null;

  // Update proposal status to submitted and re-query with profile
  const updatedProposal = await db.transaction(async (tx) => {
    const proposalDataUpdate =
      collaborationDocVersionId != null || location || categoryLabels
        ? {
            ...(existingProposal.proposalData as Record<string, unknown>),
            ...(location ? { location } : {}),
            ...(collaborationDocVersionId != null
              ? { collaborationDocVersionId }
              : {}),
            ...(categoryLabels
              ? {
                  category:
                    categoryLabels.length > 0 ? categoryLabels : undefined,
                }
              : {}),
          }
        : undefined;

    const [submittedProposal] = await tx
      .update(proposals)
      .set({
        status: ProposalStatus.SUBMITTED,
        ...(proposalDataUpdate ? { proposalData: proposalDataUpdate } : {}),
      })
      .where(eq(proposals.id, data.proposalId))
      .returning();

    if (!submittedProposal) {
      throw new CommonError('Failed to submit proposal');
    }

    // Fragments are authoritative at submit — project the validated location
    // onto the proposal's profile (clears the link when the template has no
    // location field).
    await syncProposalProfileLocation(
      tx,
      existingProposal.profileId,
      proposalDataUpdate ??
        (existingProposal.proposalData as Record<string, unknown>),
    );

    // Persist the proposal's categories — including the location's council
    // district, already filled into the validated data — through the normal
    // category link. Only location-collecting templates re-link on submit;
    // others keep the category links written during draft autosave.
    if (categoryLabels) {
      await setProposalCategories({
        tx,
        proposalId: submittedProposal.id,
        labels: categoryLabels,
      });
      // Keep by-category assignments consistent with the freshly-persisted
      // categories, in the same tx. Normally a no-op here — submission happens
      // before the review phase — but correct if this proposal is already in a
      // live by_category review phase.
      await reconcileReviewAssignments({
        db: tx,
        instanceId: instance.id,
        affected: { proposalIds: [submittedProposal.id] },
      });
    }

    const proposal = await tx.query.proposals.findFirst({
      where: { id: submittedProposal.id },
      with: { profile: true },
    });

    if (!proposal) {
      throw new CommonError('Failed to submit proposal');
    }

    return proposal;
  });

  // First point the proposal can appear as a merge candidate, so this is where
  // its title earns an embedding — drafts are skipped precisely so autosave
  // doesn't bill one per keystroke. Best-effort and non-blocking.
  waitUntil(syncProposalTitleEmbedding({ proposalId: updatedProposal.id }));

  return updatedProposal;
};
