export interface UserProfile {
  id: string;
  name: string;
}

export interface PostFeedUser {
  currentProfile?: UserProfile | null;
}

/**
 * The only fields a cached entry needs for a like to be flipped on it. Kept
 * structural rather than tied to the full post encoder so any cache shape that
 * carries a post — feed row, comment, detail payload — can be mapped through.
 */
export type LikeableItem = {
  post: { id?: string | null } & Partial<PostLikeState>;
};

export type PostLikeState = {
  likeCount: number;
  userHasLiked: boolean;
  likeUsers: Array<{ id: string; name: string; timestamp: Date }>;
};

/**
 * Flips a like locally: the count moves by one and the viewer joins or leaves
 * the named likers. Without a current profile there is nobody to name, so only
 * the count moves.
 */
export const applyLikeToggle = (
  current: PostLikeState,
  currentProfile?: UserProfile | null,
): PostLikeState => {
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
export const togglePostLike = <T extends LikeableItem>(
  item: T,
  postId: string,
  user?: PostFeedUser,
): T => {
  if (item.post.id !== postId) {
    return item;
  }

  return {
    ...item,
    post: {
      ...item.post,
      ...applyLikeToggle(
        {
          likeCount: item.post.likeCount ?? 0,
          userHasLiked: item.post.userHasLiked ?? false,
          likeUsers: item.post.likeUsers ?? [],
        },
        user?.currentProfile,
      ),
    },
  };
};
