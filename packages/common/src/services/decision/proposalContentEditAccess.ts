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

/**
 * Whether the content of this proposal is open to edits for a caller who
 * already holds `hasProposalContentEditPermission`.
 */
export async function isProposalContentEditOpen({
  proposal,
  instance,
  instanceRoles,
}: {
  proposal: { id: string; status: string | null };
  instance: {
    id: string;
    instanceData: unknown;
    currentStateId: string | null;
    phases: readonly PhaseInstanceData[];
  };
  instanceRoles: NormalizedRole[];
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

  const isInstanceAdmin = checkPermission(
    [{ profile: permission.ADMIN }, { decisions: permission.ADMIN }],
    instanceRoles,
  );

  if (isInstanceAdmin) {
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
