import { db } from '@op/db/client';
import { ProposalRelationshipType } from '@op/db/schema';

import { hasEmail } from '../../utils/email';

export type ProposalMergeNotification = {
  sourceProposalName: string;
  /** Proposals are addressed by their profile id in app URLs, not their own id. */
  sourceProposalProfileId: string;
  targetProposalName: string;
  targetProposalProfileId: string;
  processTitle: string;
  processProfileSlug: string;
  recipients: Array<{ email: string }>;
};

export type ListProposalMergeRecipientsResult =
  | { ok: true; notification: ProposalMergeNotification }
  | {
      ok: false;
      reason: 'edgeNotLive' | 'proposalUnavailable' | 'noRecipients';
    };

/**
 * Resolves who should hear that a proposal was merged away, and the copy the
 * email needs. Returns a reason rather than throwing when there is nothing to
 * send: none of these outcomes is a failure, and the caller logs which one it
 * hit.
 *
 * Everything is re-read at send time rather than carried on the event, because
 * the notification is debounced and the world can move underneath it — the merge
 * can be undone, or either proposal can be pulled.
 *
 * Deliberately no authorization assert: there is no caller to authorize. This
 * runs from the merge workflow, and the audience is derived rather than
 * requested — it is exactly the proposal's own authors, who can always reach it.
 */
export async function listProposalMergeRecipients({
  relationshipId,
  actorAuthUserId,
}: {
  relationshipId: string;
  actorAuthUserId: string;
}): Promise<ListProposalMergeRecipientsResult> {
  const relationship = await db.query.proposalRelationships.findFirst({
    where: {
      id: relationshipId,
      relationshipType: ProposalRelationshipType.MERGED,
      deletedAt: { isNull: true },
    },
    with: {
      sourceProposal: {
        with: {
          profile: { with: { profileUsers: true } },
          processInstance: { with: { profile: true } },
        },
      },
      targetProposal: { with: { profile: true } },
    },
  });

  // Gone or soft-deleted: the merge was undone before the debounce elapsed, and
  // telling someone their proposal was merged would now be false.
  if (!relationship) {
    return { ok: false, reason: 'edgeNotLive' };
  }

  const { sourceProposal, targetProposal } = relationship;
  const processProfile = sourceProposal.processInstance?.profile;

  // Nobody gets a link to a proposal that has been pulled. `moderationDetachedAt`
  // hides a proposal from everyone including admins, which is the same treatment
  // `getLinkedProposal` gives it.
  if (
    !processProfile ||
    !isReachable(sourceProposal) ||
    !isReachable(targetProposal)
  ) {
    return { ok: false, reason: 'proposalUnavailable' };
  }

  const recipients = collectRecipients({
    profileUsers: sourceProposal.profile.profileUsers,
    actorAuthUserId,
  });

  if (recipients.length === 0) {
    return { ok: false, reason: 'noRecipients' };
  }

  return {
    ok: true,
    notification: {
      sourceProposalName: sourceProposal.profile.name,
      sourceProposalProfileId: sourceProposal.profileId,
      targetProposalName: targetProposal.profile.name,
      targetProposalProfileId: targetProposal.profileId,
      processTitle: processProfile.name,
      processProfileSlug: processProfile.slug,
      recipients,
    },
  };
}

const isReachable = (proposal: {
  deletedAt: string | null;
  moderationDetachedAt: string | null;
}) => !proposal.deletedAt && !proposal.moderationDetachedAt;

/**
 * The proposal's own profile carries its author and every collaborator, so one
 * row set is the whole audience. The admin who ran the merge is dropped — nobody
 * needs an email about something they just did — and addresses are collapsed so
 * a person on two collaborator rows is mailed once.
 */
const collectRecipients = ({
  profileUsers,
  actorAuthUserId,
}: {
  profileUsers: Array<{ email: string | null; authUserId: string }>;
  actorAuthUserId: string;
}): Array<{ email: string }> => {
  const seen = new Set<string>();

  return profileUsers
    .filter(hasEmail)
    .filter((profileUser) => profileUser.authUserId !== actorAuthUserId)
    .filter((profileUser) => {
      const key = profileUser.email.toLowerCase();

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);

      return true;
    })
    .map(({ email }) => ({ email }));
};
