import { and, db, eq } from '@op/db/client';
import {
  ProposalReviewRequestState,
  ProposalStatus,
  proposalReviewAssignments,
  proposalReviewRequests,
} from '@op/db/schema';
import { type NormalizedRole, checkPermission, permission } from 'access-zones';

import { isDevelopWindowOpen } from './isDevelopWindowOpen';
import type { PhaseInstanceData } from './schemas/instanceData';
import { isPostSubmissionEditingAllowed } from './utils/phaseSettings';

export type ProposalContentEditAccess = 'allowed' | 'forbidden' | 'closed';

type ContentEditProposal = { id: string; status: string | null };

type ContentEditInstance = {
  id: string;
  instanceData: unknown;
  currentStateId: string | null;
  phases: readonly PhaseInstanceData[];
};

/** `profile: UPDATE` on the proposal, or `decisions: UPDATE` on the decision. */
export function hasProposalContentEditPermission({
  proposalRoles,
  instanceRoles,
}: {
  proposalRoles: NormalizedRole[];
  instanceRoles: NormalizedRole[];
}): boolean {
  return (
    checkPermission({ profile: permission.UPDATE }, proposalRoles) ||
    checkPermission({ decisions: permission.UPDATE }, instanceRoles)
  );
}

/** `profile: ADMIN` or `decisions: ADMIN` on the decision profile. */
export function hasDecisionAdminPermission({
  instanceRoles,
}: {
  instanceRoles: NormalizedRole[];
}): boolean {
  return checkPermission(
    [{ profile: permission.ADMIN }, { decisions: permission.ADMIN }],
    instanceRoles,
  );
}

/**
 * Combines the caller's role facts with the edit window of the proposal. A
 * decision admin edits outside the window.
 */
export async function resolveProposalContentEditAccess({
  canEditContent,
  isDecisionAdmin,
  proposal,
  instance,
}: {
  canEditContent: boolean;
  isDecisionAdmin: boolean;
  proposal: ContentEditProposal;
  instance: ContentEditInstance;
}): Promise<ProposalContentEditAccess> {
  if (!canEditContent) {
    return 'forbidden';
  }

  if (isDecisionAdmin) {
    return 'allowed';
  }

  return (await isProposalContentEditWindowOpen({ proposal, instance }))
    ? 'allowed'
    : 'closed';
}

async function isProposalContentEditWindowOpen({
  proposal,
  instance,
}: {
  proposal: ContentEditProposal;
  instance: ContentEditInstance;
}): Promise<boolean> {
  if (
    proposal.status === ProposalStatus.DRAFT ||
    isPostSubmissionEditingAllowed({
      phases: instance.phases,
      currentPhaseId: instance.currentStateId,
    })
  ) {
    return true;
  }

  // An advanced entry stays editable until the develop window closes.
  if (await isDevelopWindowOpen({ instance })) {
    return true;
  }

  // An open revision request is itself the invitation to edit, and the editor
  // autosaves system fields through here on the way to `resubmit`.
  return hasOpenRevisionRequest(proposal.id);
}

async function hasOpenRevisionRequest(proposalId: string): Promise<boolean> {
  const [openRequest] = await db
    .select({ id: proposalReviewRequests.id })
    .from(proposalReviewRequests)
    .innerJoin(
      proposalReviewAssignments,
      eq(proposalReviewRequests.assignmentId, proposalReviewAssignments.id),
    )
    .where(
      and(
        eq(proposalReviewAssignments.proposalId, proposalId),
        eq(proposalReviewRequests.state, ProposalReviewRequestState.REQUESTED),
      ),
    )
    .limit(1);

  return openRequest !== undefined;
}
