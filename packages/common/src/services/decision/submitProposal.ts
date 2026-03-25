import { getTipTapClient } from '@op/collab';
import { db, eq } from '@op/db/client';
import { type ProcessInstance, ProposalStatus, proposals } from '@op/db/schema';
import { assertAccess, permission } from 'access-zones';

import { CommonError, NotFoundError, ValidationError } from '../../utils';
import { getProfileAccessUser } from '../access';
import { decisionPermission } from './permissions';
import { parseProposalData } from './proposalDataSchema';
import { resolveProposalTemplate } from './resolveProposalTemplate';
import type { DecisionInstanceData } from './schemas/instanceData';
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
    throw new NotFoundError('Proposal');
  }

  // Only allow submitting drafts
  if (existingProposal.status !== ProposalStatus.DRAFT) {
    throw new ValidationError(
      'Only draft proposals can be submitted. This proposal has already been submitted.',
    );
  }

  const instance = existingProposal.processInstance as ProcessInstance;

  if (!instance.profileId) {
    throw new NotFoundError('Decision profile not found');
  }

  // Authorization check - verify user has access to the decision profile
  const profileUser = await getProfileAccessUser({
    user: { id: authUserId },
    profileId: instance.profileId,
  });

  assertAccess(
    [
      { profile: permission.ADMIN },
      { decisions: decisionPermission.SUBMIT_PROPOSALS },
    ],
    profileUser?.roles ?? [],
  );

  const instanceData = instance.instanceData as DecisionInstanceData;
  const currentPhaseId = instanceData.currentPhaseId;

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

  // Validation and version fetch are independent — run them in parallel.
  // The version fetch is best-effort; failures are logged but never block.
  const [, collaborationDocVersionId] = await Promise.all([
    proposalTemplate
      ? validateProposalAgainstTemplate(
          proposalTemplate,
          existingProposal.proposalData,
          existingProposal.profile.name,
        )
      : undefined,
    parsed.collaborationDocId
      ? getTipTapClient()
          .getLatestVersionId(parsed.collaborationDocId)
          .catch((error: unknown) => {
            console.error(
              `[submitProposal] Failed to fetch TipTap version for ${parsed.collaborationDocId}:`,
              error,
            );
            return null;
          })
      : null,
  ]);

  // Update proposal status to submitted and re-query with profile
  const updatedProposal = await db.transaction(async (tx) => {
    const proposalDataUpdate =
      collaborationDocVersionId != null
        ? {
            ...(existingProposal.proposalData as Record<string, unknown>),
            collaborationDocVersionId,
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
