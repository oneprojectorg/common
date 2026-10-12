'use client';

import { trpc } from '@op/api/client';

import { useTranslateLink } from '@/components/decisions/useTranslateLink';

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
