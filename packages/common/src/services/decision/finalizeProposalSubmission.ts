import { getTipTapClient } from '@op/collab';
import { db, eq } from '@op/db/client';
import {
  type ProcessInstance,
  ProposalStatus,
  processInstances,
  proposals,
} from '@op/db/schema';
import { logger } from '@op/logging';

import { CommonError } from '../../utils';
import { assertProposalSubmittable } from './assertProposalSubmittable';
import { lockProcessInstanceOrThrow } from './lockProcessInstance';
import { normalizeProposalCategories } from './proposalDataSchema';
import { reconcileReviewAssignments } from './reconcileReviewAssignments';
import type { DecisionInstanceData } from './schemas/instanceData';
import { setProposalCategories } from './setProposalCategories';
import { syncProposalProfileLocation } from './syncProposalProfileLocation';
import { templateCollectsLocation } from './templateLocation';

/**
 * Validates a draft proposal against its template and moves it to
 * 'submitted'. The caller asserts access, the draft status and the phase
 * first.
 */
export const finalizeProposalSubmission = async ({
  proposal: existingProposal,
  instance,
  instanceData,
}: {
  proposal: Pick<
    typeof proposals.$inferSelect,
    'id' | 'formSchemaId' | 'proposalData' | 'profileId'
  > & { profile: { name: string } };
  instance: Pick<ProcessInstance, 'id' | 'processId'> & { profileId: string };
  instanceData: DecisionInstanceData;
}) => {
  const { proposalTemplate, assembledData, location, collaborationDocId } =
    await assertProposalSubmittable({
      proposal: existingProposal,
      instance: {
        processId: instance.processId,
        profileId: instance.profileId,
        instanceData,
      },
    });

  // Stamp the latest TipTap version into proposalData so the history row
  // created by the DB trigger links back to a concrete document revision.
  // Best-effort — failures are logged and never block the submit.
  const collaborationDocVersionId = await getTipTapClient()
    .createVersion(collaborationDocId, { name: 'Submitted' })
    .then((v) => v?.version ?? null)
    .catch((error: unknown) => {
      logger.error('[submitProposal] Failed to create TipTap version', {
        collaborationDocId,
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

  const updatedProposal = await db.transaction(async (tx) => {
    const locked = await lockProcessInstanceOrThrow({
      db: tx,
      instanceId: instance.id,
    });
    const current = await tx.query.proposals.findFirst({
      where: { id: existingProposal.id },
      columns: { shortCode: true },
    });
    const assignsCode = current?.shortCode == null;
    const shortCode = current?.shortCode ?? locked.nextShortCode;

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
        shortCode,
        ...(proposalDataUpdate ? { proposalData: proposalDataUpdate } : {}),
      })
      .where(eq(proposals.id, existingProposal.id))
      .returning();

    if (!submittedProposal) {
      throw new CommonError('Failed to submit proposal');
    }

    if (assignsCode) {
      await tx
        .update(processInstances)
        .set({ nextShortCode: locked.nextShortCode + 1 })
        .where(eq(processInstances.id, instance.id));
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

  return updatedProposal;
};
