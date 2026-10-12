'use client';

import { trpc } from '@op/api/client';

import { useTranslateLink } from '@/components/decisions/useTranslateLink';

/**
 * A post's own "See translation" — a proposal comment or a decision update,
 * each its own authored object, translated on its own. Translating one post
 * leaves the others, and the proposal they sit under, alone.
 */
export const usePostTranslation = ({
  postId,
  content,
  enabled,
}: {
  postId: string;
  content: string;
  enabled: boolean;
}) => {
  const translatePost = trpc.translation.translatePost.useMutation();

  return useTranslateLink({
    detectionText: enabled ? content : '',
    enabled,
    request: (targetLocale) =>
      translatePost
        .mutateAsync({ postId, targetLocale })
        .then((data) => data.content || undefined),
  });
};
