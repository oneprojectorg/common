import type { Post } from '@op/api/encoders';

export interface UserProfile {
  id: string;
  name: string;
}

export interface PostFeedUser {
  currentProfile?: UserProfile | null;
}

/** The like fields the encoder puts on every post, kept in step with it. */
export type PostLikeState = Pick<
  Post,
  'likeCount' | 'userHasLiked' | 'likeUsers'
>;

/**
 * The only shape a cached entry needs for a like to be flipped on it. Any cache
 * entry carrying a post — feed row, comment, detail payload — matches.
 */
export type LikeableItem = {
  post: { id: string } & PostLikeState;
};

/**
 * Flips a like locally: the count moves by one and the viewer joins or leaves
 * the named likers. Without a current profile there is nobody to name, so only
 * the count moves.
 */
export const applyLikeToggle = ({
  current,
  currentProfile,
}: {
  current: PostLikeState;
  currentProfile?: UserProfile | null;
}): PostLikeState => {
  const userHasLiked = !current.userHasLiked;
  const others = currentProfile
    ? current.likeUsers.filter((liker) => liker.id !== currentProfile.id)
    : current.likeUsers;

  return {
    userHasLiked,
    likeCount: Math.max(0, current.likeCount + (userHasLiked ? 1 : -1)),
    likeUsers:
      userHasLiked && currentProfile
        ? [
            {
              id: currentProfile.id,
              name: currentProfile.name,
              timestamp: new Date(),
            },
            ...others,
          ]
        : others,
  };
};

/**
 * Applies {@link applyLikeToggle} to the matching post in a cached feed item,
 * leaving every other item untouched. Preserves the input type shape so it can
 * be mapped straight over a react-query cache entry.
 */
export const togglePostLike = <T extends LikeableItem>({
  item,
  postId,
  user,
}: {
  item: T;
  postId: string;
  user?: PostFeedUser;
}): T => {
  if (item.post.id !== postId) {
    return item;
  }

  return {
    ...item,
    post: {
      ...item.post,
      ...applyLikeToggle({
        current: item.post,
        currentProfile: user?.currentProfile,
      }),
    },
  };
};
