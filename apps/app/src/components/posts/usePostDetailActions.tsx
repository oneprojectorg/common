'use client';
import type { PostFeedUser } from '@/utils/optimisticUpdates';
import { togglePostLike } from '@/utils/optimisticUpdates';
import { createCommentsQueryKey } from '@/utils/queryKeys';
import { useTRPC } from '@op/api/client';
import { toast } from '@op/sense/Toast';
import { useMutation } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';

import { useTranslations } from '@/lib/i18n';

/**
 * Hook for handling likes on the post detail page.
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
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const t = useTranslations();

  const toggleLike = useMutation(
    trpc.organization.toggleLike.mutationOptions({
      onMutate: async ({ postId: likedPostId }) => {
        // Query keys for the detail page
        const mainPostQueryKey = {
          postId,
          includeChildren: false,
        };
        const commentsQueryKey = createCommentsQueryKey(postId, undefined);

        // Cancel outgoing refetches
        await queryClient.cancelQueries(
          trpc.posts.getPost.queryFilter(mainPostQueryKey),
        );
        await queryClient.cancelQueries(
          trpc.posts.getPosts.queryFilter(commentsQueryKey),
        );

        // Snapshot previous values
        const previousMainPost = queryClient.getQueryData(
          trpc.posts.getPost.queryKey(mainPostQueryKey),
        );
        const previousComments = queryClient.getQueryData(
          trpc.posts.getPosts.queryKey(commentsQueryKey),
        );

        // Optimistically update main post
        queryClient.setQueryData(
          trpc.posts.getPost.queryKey(mainPostQueryKey),
          (old) => {
            if (!old) {
              return old;
            }

            return togglePostLike({
              item: { post: old },
              postId: likedPostId,
              user,
            }).post;
          },
        );

        // Optimistically update comments
        queryClient.setQueryData(
          trpc.posts.getPosts.queryKey(commentsQueryKey),
          (old) => {
            if (!old) {
              return old;
            }

            return {
              items: old.items.map(
                (comment) =>
                  togglePostLike({
                    item: { post: comment },
                    postId: likedPostId,
                    user,
                  }).post,
              ),
            };
          },
        );

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
          queryClient.setQueryData(
            trpc.posts.getPost.queryKey(mainPostQueryKey),
            context.previousMainPost,
          );
        }
        if (context?.previousComments) {
          queryClient.setQueryData(
            trpc.posts.getPosts.queryKey(commentsQueryKey),
            context.previousComments,
          );
        }

        toast.error(err.message || t('Failed to update like'));
      },
      // The detail page never refetches on its own (`refetchOnWindowFocus` is
      // off), so without this a batched double-click — where both requests race
      // to "added" and the two optimistic flips cancel out — leaves the button
      // disagreeing with the server until a full reload.
      onSettled: () => {
        void queryClient.invalidateQueries(trpc.posts.getPost.pathFilter());
        void queryClient.invalidateQueries(trpc.posts.getPosts.pathFilter());
      },
    }),
  );

  const handleLikeClick = (likedPostId: string) =>
    toggleLike.mutateAsync({ postId: likedPostId });

  return { handleLikeClick };
};
