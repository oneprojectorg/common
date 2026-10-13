'use client';

import { trpc } from '@op/api/client';
import type { ProposalReviewRequest } from '@op/common/client';

import { TranslateLink } from './TranslateLink';
import { RevisionFeedbackCard } from './proposalEditor/RevisionFeedbackCard';
import { useTranslateLink } from './useTranslateLink';

export function RevisionRequestCard({
  request,
}: {
  request: Pick<ProposalReviewRequest, 'id' | 'requestComment' | 'requestedAt'>;
}) {
  const translateRequest =
    trpc.translation.translateRevisionRequest.useMutation();

  const translation = useTranslateLink({
    detectionText: request.requestComment,
    enabled: true,
    request: (targetLocale) =>
      translateRequest
        .mutateAsync({ requestId: request.id, targetLocale })
        .then(({ requestComment }) => requestComment || undefined),
  });

  return (
    <RevisionFeedbackCard
      comment={translation.translation ?? request.requestComment}
      sentAt={request.requestedAt}
      variant="request"
      meta="bare"
      translateLink={<TranslateLink translation={translation} />}
    />
  );
}
