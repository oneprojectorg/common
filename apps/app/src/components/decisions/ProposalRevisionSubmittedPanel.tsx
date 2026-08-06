'use client';

import type { ProposalReviewRequest } from '@op/common/client';
import { Header3, Header4 } from '@op/sense/Header';

import { useTranslations } from '@/lib/i18n';

import { RevisionFeedbackCard } from './proposalEditor/RevisionFeedbackCard';

interface ProposalRevisionSubmittedPanelProps {
  revisionRequest: ProposalReviewRequest;
}

export function ProposalRevisionSubmittedPanel({
  revisionRequest,
}: ProposalRevisionSubmittedPanelProps) {
  const t = useTranslations();
  const { requestComment, requestedAt, responseComment, respondedAt } =
    revisionRequest;

  return (
    <div className="flex flex-col gap-6 px-12 pt-12 pb-4">
      <div className="flex flex-col gap-4 border-b border-border pb-4">
        <Header3>{t('Revision submitted')}</Header3>

        <p className="text-base text-foreground">
          {t(
            'Your revision has been submitted and reviewers have been notified.',
          )}
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <Header4>{t('Reviewer feedback')}</Header4>

        <RevisionFeedbackCard
          comment={requestComment}
          sentAt={requestedAt}
          variant="reviewer"
        />
      </div>

      {responseComment && (
        <div className="flex flex-col gap-4">
          <Header4>{t('Your revision note')}</Header4>

          <RevisionFeedbackCard
            comment={responseComment}
            sentAt={respondedAt}
            variant="author"
          />
        </div>
      )}
    </div>
  );
}
