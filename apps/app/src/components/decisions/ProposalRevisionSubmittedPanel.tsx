'use client';

import type { ProposalReviewRequest } from '@op/common/client';
import { Header3 } from '@op/ui/Header';

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
        <Header3 className="font-serif text-title-base">
          {t('Revision submitted')}
        </Header3>

        <p className="text-foreground">
          {t(
            'Your revision has been submitted and reviewers have been notified.',
          )}
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <span className="font-serif text-title-sm14 text-foreground">
          {t('Reviewer feedback')}
        </span>

        <RevisionFeedbackCard
          comment={requestComment}
          sentAt={requestedAt}
          variant="reviewer"
        />
      </div>

      {responseComment && (
        <div className="flex flex-col gap-4">
          <span className="font-serif text-title-sm14 text-foreground">
            {t('Your revision note')}
          </span>

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
