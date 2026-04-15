'use client';

import type { ProposalReviewRequest } from '@op/common/client';
import { useRelativeTime } from '@op/hooks';
import { Header3 } from '@op/ui/Header';

import { useTranslations } from '@/lib/i18n';

interface RevisionFeedbackPanelProps {
  revisionRequest: ProposalReviewRequest;
}

export function RevisionFeedbackPanel({
  revisionRequest,
}: RevisionFeedbackPanelProps) {
  const t = useTranslations();

  return (
    <div className="flex flex-col gap-6 p-8">
      <Header3 className="font-serif text-title-sm">
        {t('Revision feedback')}
      </Header3>

      <p className="text-sm text-neutral-charcoal">
        {t(
          'The review committee has requested changes to your proposal. Edit your proposal and resubmit when ready.',
        )}
      </p>

      <div className="flex flex-col gap-3">
        <span className="text-sm font-medium text-primary-teal">
          {t('Reviewer feedback')}
        </span>

        <FeedbackCard
          comment={revisionRequest.requestComment}
          requestedAt={revisionRequest.requestedAt}
        />
      </div>

      <p className="text-sm text-neutral-gray4">
        {t(
          'When resubmitting, address each point in the feedback above. Describe what you changed in the resubmission form.',
        )}
      </p>
    </div>
  );
}

function FeedbackCard({
  comment,
  requestedAt,
}: {
  comment: string;
  requestedAt: string | null;
}) {
  const t = useTranslations();
  const timeAgo = useRelativeTime(requestedAt ?? new Date().toISOString(), {
    style: 'long',
  });

  return (
    <div className="rounded-sm border border-neutral-gray2 bg-neutral-gray1/30 p-4">
      <p className="text-sm whitespace-pre-wrap text-neutral-charcoal italic">
        {comment}
      </p>
      {requestedAt && (
        <p className="mt-3 text-xs text-neutral-gray4">
          {t('Sent {timeAgo}', { timeAgo })}
        </p>
      )}
    </div>
  );
}
