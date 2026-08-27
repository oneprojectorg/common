import type { PostToOrganization } from '@op/api/encoders';

export interface UserProfile {
  id: string;
  name: string;
}

export interface PostFeedUser {
  currentProfile?: UserProfile | null;
}

/**
 * A more flexible type for optimistic updates that only requires the post property
 */
export type PostItem = Pick<PostToOrganization, 'post'> &
  Partial<Omit<PostToOrganization, 'post'>>;

/**
 * Handles optimistic updates for post likes
 */
export class OptimisticLikeUpdater {
  constructor(private user?: PostFeedUser) {}

  /**
   * Flips a post's like state optimistically.
   * Uses a generic to preserve the input type shape.
   */
  togglePostLike = <T extends PostItem>(item: T, postId: string): T => {
    if (item.post.id !== postId) {
      return item;
    }

    const liked = !item.post.userHasLiked;
    const currentProfile = this.user?.currentProfile;
    const others = currentProfile
      ? (item.post.likeUsers ?? []).filter(
          (liker) => liker.id !== currentProfile.id,
        )
      : (item.post.likeUsers ?? []);

    return {
      ...item,
      post: {
        ...item.post,
        userHasLiked: liked,
        likeCount: Math.max(0, (item.post.likeCount ?? 0) + (liked ? 1 : -1)),
        likeUsers:
          liked && currentProfile
            ? [
                {
                  id: currentProfile.id,
                  name: currentProfile.name,
                  timestamp: new Date(),
                },
                ...others,
              ]
            : others,
      },
    };
  };
}

/**
 * Factory function to create an optimistic updater
 */
export const createOptimisticUpdater = (user?: PostFeedUser) =>
  new OptimisticLikeUpdater(user);
