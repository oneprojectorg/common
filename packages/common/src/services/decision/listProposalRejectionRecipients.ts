import { db } from '@op/db/client';
import { ProposalStatus } from '@op/db/schema';

import { hasEmail } from '../../utils/email';
import type { DecisionInstanceData } from './schemas/instanceData';
import { getNextPhaseName, isProposalReachable } from './utils/proposal';

export type ProposalRejectionNotification = {
  proposalName: string;
  /** App URLs address a proposal by its profile id, not its own id. */
  proposalProfileId: string;
  /** The phase the proposal failed to reach; absent on the last phase. */
  phaseName?: string;
  processProfileSlug: string;
  /** Authors of the rejected proposal, minus the admin who rejected it. */
  recipients: Array<{ email: string }>;
};

export type ListProposalRejectionRecipientsResult =
  | { ok: true; notification: ProposalRejectionNotification }
  | {
      ok: false;
      reason: 'notRejected' | 'proposalUnavailable' | 'noRecipients';
    };

/**
 * Who hears about a rejection, and the copy they need. Re-read at send time
 * because the notification is debounced and the toast puts Undo one tap away —
 * a rejection reversed inside that window must not still email the author.
 * Empty outcomes return a reason rather than throwing. Nothing to authorize:
 * the audience is derived, not requested.
 */
export async function listProposalRejectionRecipients({
  proposalId,
  actorAuthUserId,
}: {
  proposalId: string;
  actorAuthUserId: string;
}): Promise<ListProposalRejectionRecipientsResult> {
  const proposal = await db.query.proposals.findFirst({
    where: { id: proposalId },
    with: {
      profile: { with: { profileUsers: true } },
      processInstance: { with: { profile: true } },
    },
  });

  if (!proposal) {
    return { ok: false, reason: 'proposalUnavailable' };
  }

  // Undone inside the debounce window.
  if (proposal.status !== ProposalStatus.REJECTED) {
    return { ok: false, reason: 'notRejected' };
  }

  const processProfile = proposal.processInstance?.profile;

  if (!processProfile || !isProposalReachable(proposal)) {
    return { ok: false, reason: 'proposalUnavailable' };
  }

  // An admin rejecting their own proposal should not be emailed about it.
  const recipients = proposal.profile.profileUsers
    .filter(hasEmail)
    .filter(({ authUserId }) => authUserId !== actorAuthUserId)
    .map(({ email }) => ({ email }));

  if (recipients.length === 0) {
    return { ok: false, reason: 'noRecipients' };
  }

  const instanceData = proposal.processInstance
    ?.instanceData as DecisionInstanceData | null;

  return {
    ok: true,
    notification: {
      proposalName: proposal.profile.name,
      proposalProfileId: proposal.profileId,
      phaseName: getNextPhaseName({
        phases: instanceData?.phases ?? [],
        currentPhaseId: proposal.processInstance?.currentStateId ?? null,
      }),
      processProfileSlug: processProfile.slug,
      recipients,
    },
  };
}
