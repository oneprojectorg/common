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
   * Likers the read joined a profile for, so the UI can name them. A post can
   * have more likes than entries here, which is why `likeCount` is separate.
   */
  likeUsers: LikeUser[];
};

/**
 * Folds a post's reaction rows into the single like the UI shows.
 *
 * Reactions predate the like button and were never migrated, so every positive
 * historical type still counts (see `isLikeReactionType`). A viewer whose only
 * row is a dropped type reads as not having liked, and liking replaces that row.
 */
export const getLikeSummary = ({
  reactions,
  profileId,
}: {
  reactions: readonly ReactionRow[];
  profileId?: string;
}): LikeSummary => {
  const likes = reactions.filter((reaction) =>
    isLikeReactionType(reaction.reactionType),
  );

  const likeUsers = likes.flatMap((reaction) =>
    reaction.profile
      ? [
          {
            id: reaction.profile.id,
            name: reaction.profile.name,
            timestamp: toTimestamp(reaction.createdAt),
          },
        ]
      : [],
  );

  return {
    likeCount: likes.length,
    userHasLiked: Boolean(
      profileId && likes.some((reaction) => reaction.profileId === profileId),
    ),
    likeUsers,
  };
};

const toTimestamp = (createdAt: ReactionRow['createdAt']): Date => {
  const timestamp = createdAt ? new Date(createdAt) : new Date();

  return isNaN(timestamp.getTime()) ? new Date() : timestamp;
};
