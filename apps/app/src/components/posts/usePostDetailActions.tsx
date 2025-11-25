'use client';

import type { PostFeedUser } from '@/utils/optimisticUpdates';
import { createOptimisticUpdater } from '@/utils/optimisticUpdates';
import { createCommentsQueryKey } from '@/utils/queryKeys';
import { trpc } from '@op/api/client';
import { REACTION_OPTIONS } from '@op/types';
import { toast } from '@op/ui/Toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useTranslations } from '@/lib/i18n';

export const usePostDetailActions = ({
  postId,
  user,
}: {
  postId: string;
  user?: PostFeedUser;
}) => {
  const queryClient = useQueryClient();
  const t = useTranslations();

  const toggleReaction = useMutation({
    mutationFn: (input: Parameters<typeof trpc.organization.toggleReaction.mutate>[0]) =>
      trpc.organization.toggleReaction.mutate(input),
    onMutate: async ({ postId: reactionPostId, reactionType }) => {
      // Query keys for the detail page
      const mainPostQueryKey = {
        postId,
        includeChildren: false,
      };
      const commentsQueryKey = createCommentsQueryKey(postId, undefined);

      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: [['posts', 'getPost'], mainPostQueryKey] });
      await queryClient.cancelQueries({ queryKey: [['posts', 'getPosts'], commentsQueryKey] });

      // Snapshot previous values
      const previousMainPost = queryClient.getQueryData([['posts', 'getPost'], mainPostQueryKey]);
      const previousComments = queryClient.getQueryData([['posts', 'getPosts'], commentsQueryKey]);

      // Create optimistic updater
      const optimisticUpdater = createOptimisticUpdater(user);

      // Optimistically update main post
      queryClient.setQueryData([['posts', 'getPost'], mainPostQueryKey], (old: any) => {
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
      queryClient.setQueryData([['posts', 'getPosts'], commentsQueryKey], (old: any) => {
        if (!old) {
          return old;
        }

        return old.map((comment: any) => {
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
        queryClient.setQueryData([['posts', 'getPost'], mainPostQueryKey], context.previousMainPost);
      }
      if (context?.previousComments) {
        queryClient.setQueryData(
          [['posts', 'getPosts'], commentsQueryKey],
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
