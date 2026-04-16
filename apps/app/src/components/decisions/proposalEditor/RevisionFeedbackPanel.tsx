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
    <div className="flex flex-col gap-6 px-12 pt-12 pb-4">
      <div className="flex flex-col gap-4 border-b border-neutral-gray1 pb-4">
        <Header3 className="font-serif text-title-base">
          {t('Revision feedback')}
        </Header3>

        <p className="text-neutral-black">
          {t(
            'A reviewer has requested changes to your proposal. Edit your proposal and resubmit when ready.',
          )}
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <span className="font-serif text-title-sm14 text-neutral-charcoal">
          {t('Reviewer feedback')}
        </span>

        <FeedbackCard
          comment={revisionRequest.requestComment}
          requestedAt={revisionRequest.requestedAt}
        />

        <p className="text-sm text-neutral-charcoal">
          {t(
            "When resubmitting, address each point in the feedback above. When you click Resubmit, you'll be asked to briefly describe what you changed so the reviewers know where to look.",
          )}
        </p>
      </div>
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
    <div className="rounded-xl border border-neutral-gray1 p-6">
      <p className="whitespace-pre-wrap text-neutral-charcoal italic">
        {comment}
      </p>
      {requestedAt && (
        <p className="mt-2 text-sm text-neutral-gray4">
          {t('Sent {timeAgo}', { timeAgo })}
        </p>
      )}
    </div>
  );
}
