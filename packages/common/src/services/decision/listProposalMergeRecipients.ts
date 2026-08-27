import { db } from '@op/db/client';
import { ProposalRelationshipType } from '@op/db/schema';

import { hasEmail } from '../../utils/email';
import { isProposalReachable } from './utils/proposal';

export type ProposalMergeNote = {
  body: string;
  /** Null when the author's profile can't be resolved. */
  authorName: string | null;
};

export type ProposalMergeNotification = {
  sourceProposalName: string;
  /** App URLs address a proposal by its profile id, not its own id. */
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
 * Who hears about a merge, and the copy each side needs. Re-read at send time
 * because the notification is debounced — the merge can be undone, or either
 * proposal pulled. Empty outcomes return a reason rather than throwing. Nothing
 * to authorize: the audience is derived, not requested.
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

  // Unmerged inside the debounce window.
  if (!relationship) {
    return { ok: false, reason: 'edgeNotLive' };
  }

  const { sourceProposal, targetProposal } = relationship;
  const processProfile = sourceProposal.processInstance?.profile;

  if (
    !processProfile ||
    !isProposalReachable(sourceProposal) ||
    !isProposalReachable(targetProposal)
  ) {
    return { ok: false, reason: 'proposalUnavailable' };
  }

  const sourceRecipients = collectRecipients({
    profileUsers: sourceProposal.profile.profileUsers,
    excludedAuthUserIds: [actorAuthUserId],
  });

  // Someone on both proposals hears only the source version. Keyed on who that
  // email actually reached, so a source row with no address doesn't drop them
  // from both sides.
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

/** The edge records no author, but the merge dialog collects the note. */
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

/** A proposal's profile carries its author and every collaborator. */
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
