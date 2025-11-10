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
 * Handles optimistic updates for post reactions
 */
export class OptimisticReactionUpdater {
  constructor(private user?: PostFeedUser) {}

  /**
   * Updates a post's reaction data optimistically
   * Uses a generic to preserve the input type shape
   */
  updatePostReactions = <T extends PostItem>(
    item: T,
    postId: string,
    reactionType: string,
  ): T => {
    if (item.post.id !== postId) {
      return item;
    }

    const currentReaction = item.post.userReaction;
    const currentCounts = { ...(item.post.reactionCounts || {}) };
    const currentReactionUsers = { ...(item.post.reactionUsers || {}) };

    const hasReaction = currentReaction === reactionType;

    if (hasReaction) {
      return this.removeReaction<T>(
        item,
        reactionType,
        currentCounts,
        currentReactionUsers,
      );
    } else {
      return this.addOrReplaceReaction<T>(
        item,
        reactionType,
        currentReaction,
        currentCounts,
        currentReactionUsers,
      );
    }
  };

  private removeReaction = <T extends PostItem>(
    item: T,
    reactionType: string,
    currentCounts: Record<string, number>,
    currentReactionUsers: Record<string, any[]>,
  ): T => {
    const newCount = Math.max(0, (currentCounts[reactionType] || 1) - 1);

    if (newCount === 0) {
      delete currentCounts[reactionType];
      delete currentReactionUsers[reactionType];
    } else {
      currentCounts[reactionType] = newCount;
      // Remove current user from the reaction users list
      if (currentReactionUsers[reactionType] && this.user?.currentProfile) {
        currentReactionUsers[reactionType] = currentReactionUsers[
          reactionType
        ].filter((u) => u.id !== this.user!.currentProfile!.id);
      }
    }

    return {
      ...item,
      post: {
        ...item.post,
        userReaction: null,
        reactionCounts: currentCounts,
        reactionUsers: currentReactionUsers,
      },
    } as T;
  };

  private addOrReplaceReaction = <T extends PostItem>(
    item: T,
    reactionType: string,
    currentReaction: string | null | undefined,
    currentCounts: Record<string, number>,
    currentReactionUsers: Record<string, any[]>,
  ): T => {
    // Remove previous reaction if exists
    if (currentReaction) {
      this.removePreviousReaction(
        currentReaction,
        currentCounts,
        currentReactionUsers,
      );
    }

    // Add new reaction
    currentCounts[reactionType] = (currentCounts[reactionType] || 0) + 1;

    // Add current user to new reaction users
    if (this.user?.currentProfile) {
      if (!currentReactionUsers[reactionType]) {
        currentReactionUsers[reactionType] = [];
      }

      // Add user at the beginning (most recent)
      currentReactionUsers[reactionType] = [
        {
          id: this.user.currentProfile.id,
          name: this.user.currentProfile.name,
          timestamp: new Date(),
        },
        ...currentReactionUsers[reactionType].filter(
          (u) => u.id !== this.user!.currentProfile!.id,
        ),
      ];
    }

    return {
      ...item,
      post: {
        ...item.post,
        userReaction: reactionType,
        reactionCounts: currentCounts,
        reactionUsers: currentReactionUsers,
      },
    } as T;
  };

  private removePreviousReaction = (
    currentReaction: string,
    currentCounts: Record<string, number>,
    currentReactionUsers: Record<string, any[]>,
  ) => {
    const prevCount = Math.max(0, (currentCounts[currentReaction] || 1) - 1);

    if (prevCount === 0) {
      delete currentCounts[currentReaction];
      delete currentReactionUsers[currentReaction];
    } else {
      currentCounts[currentReaction] = prevCount;
      // Remove current user from previous reaction users
      if (currentReactionUsers[currentReaction] && this.user?.currentProfile) {
        currentReactionUsers[currentReaction] = currentReactionUsers[
          currentReaction
        ].filter((u) => u.id !== this.user!.currentProfile!.id);
      }
    }
  };
}

/**
 * Factory function to create an optimistic updater
 */
export const createOptimisticUpdater = (user?: PostFeedUser) =>
  new OptimisticReactionUpdater(user);
