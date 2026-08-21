import { db } from '@op/db/client';
import { ProposalRelationshipType } from '@op/db/schema';

import { hasEmail } from '../../utils/email';

/** The admin's stated reason for the merge, quoted back to the source authors. */
export type ProposalMergeNote = {
  body: string;
  /** Null when the admin's profile can't be resolved; the quote still stands. */
  authorName: string | null;
};

export type ProposalMergeNotification = {
  sourceProposalName: string;
  /** Proposals are addressed by their profile id in app URLs, not their own id. */
  sourceProposalProfileId: string;
  targetProposalName: string;
  targetProposalProfileId: string;
  processTitle: string;
  processProfileSlug: string;
  note: ProposalMergeNote | null;
  /** Authors of the proposal that was merged away. */
  sourceRecipients: Array<{ email: string }>;
  /** Authors of the proposal that survived. */
  targetRecipients: Array<{ email: string }>;
};

export type ListProposalMergeRecipientsResult =
  | { ok: true; notification: ProposalMergeNotification }
  | {
      ok: false;
      reason: 'edgeNotLive' | 'proposalUnavailable' | 'noRecipients';
    };

/**
 * Resolves who should hear that a merge happened and the copy each side needs.
 * Returns a reason rather than throwing when there is nothing to send: none of
 * these outcomes is a failure, and the caller logs which one it hit.
 *
 * Everything is re-read at send time rather than carried on the event, because
 * the notification is debounced and the world can move underneath it — the merge
 * can be undone, or either proposal can be pulled.
 *
 * Deliberately no authorization assert: there is no caller to authorize. This
 * runs from the merge workflow, and the audience is derived rather than
 * requested — it is exactly the two proposals' own authors, who can always reach
 * the proposal they wrote.
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
      targetProposal: {
        with: { profile: { with: { profileUsers: true } } },
      },
    },
  });

  // Gone or soft-deleted: the merge was undone before the debounce elapsed, and
  // telling anyone it happened would now be false.
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

  const sourceRecipients = collectRecipients({
    profileUsers: sourceProposal.profile.profileUsers,
    excludedAuthUserIds: [actorAuthUserId],
  });

  // Anyone who worked on both proposals hears it once, as a source author: "your
  // proposal was merged away" is the version that affects them.
  //
  // Keyed on who actually got the source email rather than on everyone attached
  // to the source proposal. Someone whose source row carries no address was not
  // told anything by it, so excluding them here would drop them from both sides
  // and leave a reachable author silently unmailed.
  const targetRecipients = collectRecipients({
    profileUsers: targetProposal.profile.profileUsers,
    excludedAuthUserIds: [
      actorAuthUserId,
      ...sourceRecipients.map(({ authUserId }) => authUserId),
    ],
    excludedEmails: sourceRecipients.map(({ email }) => email),
  });

  if (sourceRecipients.length === 0 && targetRecipients.length === 0) {
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
      note: await resolveNote({
        body: relationship.note,
        authorAuthUserId: actorAuthUserId,
      }),
      sourceRecipients: sourceRecipients.map(({ email }) => ({ email })),
      targetRecipients: targetRecipients.map(({ email }) => ({ email })),
    },
  };
}

const isReachable = (proposal: {
  deletedAt: string | null;
  moderationDetachedAt: string | null;
}) => !proposal.deletedAt && !proposal.moderationDetachedAt;

/**
 * The note is written in the merge dialog, so its author is always the admin who
 * performed the merge — the edge itself records no author. A missing profile
 * costs the attribution line, not the note.
 */
const resolveNote = async ({
  body,
  authorAuthUserId,
}: {
  body: string | null;
  authorAuthUserId: string;
}): Promise<ProposalMergeNote | null> => {
  if (!body) {
    return null;
  }

  const author = await db.query.users.findFirst({
    where: { authUserId: authorAuthUserId },
    with: { profile: true },
  });

  return { body, authorName: author?.profile?.name ?? null };
};

/**
 * A proposal's own profile carries its author and every collaborator, so one row
 * set is the whole audience. Addresses are collapsed case-insensitively so a
 * person on two collaborator rows is mailed once.
 */
const collectRecipients = ({
  profileUsers,
  excludedAuthUserIds,
  excludedEmails = [],
}: {
  profileUsers: Array<{ email: string | null; authUserId: string }>;
  excludedAuthUserIds: Array<string>;
  excludedEmails?: Array<string>;
}): Array<{ email: string; authUserId: string }> => {
  const excludedIds = new Set(excludedAuthUserIds);
  const seen = new Set(excludedEmails.map((email) => email.toLowerCase()));

  return profileUsers
    .filter(hasEmail)
    .filter((profileUser) => !excludedIds.has(profileUser.authUserId))
    .filter((profileUser) => {
      const key = profileUser.email.toLowerCase();

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);

      return true;
    })
    .map(({ email, authUserId }) => ({ email, authUserId }));
};
