'use client';

import type { ProposalReviewRequest } from '@op/common/client';
import { Header3 } from '@op/ui/Header';

import { useTranslations } from '@/lib/i18n';

import { RevisionFeedbackCard } from './RevisionFeedbackCard';

interface RevisionFeedbackPanelProps {
  revisionRequest: ProposalReviewRequest;
}

export function RevisionFeedbackPanel({
  revisionRequest,
}: RevisionFeedbackPanelProps) {
  const t = useTranslations();

  return (
    <div className="flex flex-col gap-6 px-12 pt-12 pb-4">
      <div className="flex flex-col gap-4 border-b border-border pb-4">
        <Header3 className="font-serif text-title-base">
          {t('Revision feedback')}
        </Header3>

        <p className="text-foreground">
          {t(
            'A reviewer has requested changes to your proposal. Edit your proposal and resubmit when ready.',
          )}
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <span className="font-serif text-title-sm14 text-foreground">
          {t('Reviewer feedback')}
        </span>

        <RevisionFeedbackCard
          comment={revisionRequest.requestComment}
          sentAt={revisionRequest.requestedAt}
          variant="reviewer"
        />

        <p className="text-sm text-foreground">
          {t(
            "When resubmitting, address each point in the feedback above. When you click Resubmit, you'll be asked to briefly describe what you changed so the reviewers know where to look.",
          )}
        </p>
      </div>
    </div>
  );
}
