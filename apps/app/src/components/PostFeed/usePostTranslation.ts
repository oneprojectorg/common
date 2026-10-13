'use client';

import { trpc } from '@op/api/client';

import { useTranslateLink } from '@/components/decisions/useTranslateLink';

export const usePostTranslation = ({
  postId,
  content,
}: {
  postId: string;
  content: string;
}) => {
  const translatePost = trpc.translation.translatePost.useMutation();

  return useTranslateLink({
    detectionText: content,
    enabled: true,
    request: (targetLocale) =>
      translatePost
        .mutateAsync({ postId, targetLocale })
        .then((data) => data.content || undefined),
  });
};
