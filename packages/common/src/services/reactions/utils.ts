import { isLikeReactionType } from '@op/types';

/** A `post_reactions` row as the post reads load it. */
export type ReactionRow = {
  reactionType: string;
  createdAt?: string | Date | null;
  profileId: string;
  profile?: {
    id: string;
    name: string;
  } | null;
};

export type LikeUser = {
  id: string;
  name: string;
  timestamp: Date;
};

export type LikeSummary = {
  likeCount: number;
  userHasLiked: boolean;
  /**
   * The most recent likers the read could name, newest first, capped at
   * {@link NAMED_LIKERS_LIMIT}. Always a subset — read the total off
   * `likeCount`, never off this array's length.
   */
  likeUsers: LikeUser[];
};

/**
 * How many likers a post payload names — exactly what the tooltip renders
 * before it switches to an "and N others" built from `likeCount`. Shipping
 * every liker on a popular post would be hundreds of rows nobody reads.
 */
const NAMED_LIKERS_LIMIT = 2;

/**
 * Folds a post's reaction rows into the single like the UI shows.
 *
 * Reactions predate the like button and were never migrated, so every positive
 * historical type still counts (see `isLikeReactionType`). A viewer whose only
 * row is a dropped type reads as not having liked, and liking replaces that row.
 *
 * Counts distinct profiles rather than rows: the unique index allows one profile
 * to hold several reaction types, and those are one person's like, not several.
 */
export const getLikeSummary = ({
  reactions,
  profileId,
}: {
  reactions: readonly ReactionRow[];
  profileId?: string;
}): LikeSummary => {
  const likers = new Map<string, LikeUser | null>();
  let userHasLiked = false;

  for (const reaction of reactions) {
    if (!isLikeReactionType(reaction.reactionType)) {
      continue;
    }

    if (reaction.profileId === profileId) {
      userHasLiked = true;
    }

    const named = reaction.profile
      ? {
          id: reaction.profile.id,
          name: reaction.profile.name,
          timestamp: toTimestamp(reaction.createdAt),
        }
      : null;

    // Keep the newest row per profile so the tooltip reads newest-first.
    const existing = likers.get(reaction.profileId);
    if (
      !likers.has(reaction.profileId) ||
      (named && (!existing || named.timestamp > existing.timestamp))
    ) {
      likers.set(reaction.profileId, named);
    }
  }

  const likeUsers = [...likers.values()]
    .filter((liker): liker is LikeUser => liker !== null)
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, NAMED_LIKERS_LIMIT);

  return { likeCount: likers.size, userHasLiked, likeUsers };
};

const toTimestamp = (createdAt: ReactionRow['createdAt']): Date => {
  const timestamp = createdAt ? new Date(createdAt) : new Date();

  return isNaN(timestamp.getTime()) ? new Date() : timestamp;
};
