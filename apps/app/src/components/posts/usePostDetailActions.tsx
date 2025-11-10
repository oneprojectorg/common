'use client';

import type { PostFeedUser } from '@/utils/optimisticUpdates';
import { createOptimisticUpdater } from '@/utils/optimisticUpdates';
import { createCommentsQueryKey } from '@/utils/queryKeys';
import { trpc } from '@op/api/client';
import { REACTION_OPTIONS } from '@op/types';
import { toast } from '@op/ui/Toast';

import { useTranslations } from '@/lib/i18n';

/**
 * Hook for handling reactions on the post detail page.
 * Manages optimistic updates for both the main post and its comments.
 * Isolates the complexity of the optimistic updates to a single hook.
 */
export const usePostDetailActions = ({
  postId,
  user,
}: {
  postId: string;
  user?: PostFeedUser;
}) => {
  const utils = trpc.useUtils();
  const t = useTranslations();

  const toggleReaction = trpc.organization.toggleReaction.useMutation({
    onMutate: async ({ postId: reactionPostId, reactionType }) => {
      // Query keys for the detail page
      const mainPostQueryKey = {
        postId,
        includeChildren: false,
      };
      const commentsQueryKey = createCommentsQueryKey(postId, undefined);

      // Cancel outgoing refetches
      await utils.posts.getPost.cancel(mainPostQueryKey);
      await utils.posts.getPosts.cancel(commentsQueryKey);

      // Snapshot previous values
      const previousMainPost = utils.posts.getPost.getData(mainPostQueryKey);
      const previousComments = utils.posts.getPosts.getData(commentsQueryKey);

      // Create optimistic updater
      const optimisticUpdater = createOptimisticUpdater(user);

      // Optimistically update main post
      utils.posts.getPost.setData(mainPostQueryKey, (old) => {
        if (!old) {
          return old;
        }

        const updated = optimisticUpdater.updatePostReactions(
          { post: old },
          reactionPostId,
          reactionType,
        );
        return updated.post;
      });

      // Optimistically update comments
      utils.posts.getPosts.setData(commentsQueryKey, (old) => {
        if (!old) {
          return old;
        }

        return old.map((comment) => {
          const updated = optimisticUpdater.updatePostReactions(
            { post: comment },
            reactionPostId,
            reactionType,
          );
          return updated.post;
        });
      });

      return { previousMainPost, previousComments };
    },
    onError: (err, _variables, context) => {
      const mainPostQueryKey = {
        postId,
        includeChildren: false,
      };
      const commentsQueryKey = createCommentsQueryKey(postId);

      // Rollback on error
      if (context?.previousMainPost) {
        utils.posts.getPost.setData(mainPostQueryKey, context.previousMainPost);
      }
      if (context?.previousComments) {
        utils.posts.getPosts.setData(
          commentsQueryKey,
          context.previousComments,
        );
      }

      toast.error({ message: err.message || t('Failed to update reaction') });
    },
  });

  const handleReactionClick = (reactionPostId: string, emoji: string) => {
    // Convert emoji to reaction type
    const reactionOption = REACTION_OPTIONS.find(
      (option) => option.emoji === emoji,
    );
    const reactionType = reactionOption?.key;

    if (!reactionType) {
      console.error('Unknown emoji:', emoji);
      return;
    }

    toggleReaction.mutate({ postId: reactionPostId, reactionType });
  };

  return { handleReactionClick };
};
