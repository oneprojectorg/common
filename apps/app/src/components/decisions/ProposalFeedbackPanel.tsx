import type { ProposalFeedbackItem } from '@op/common/client';
import { Header3 } from '@op/sense/Header';

import { RevisionFeedbackCard } from './proposalEditor/RevisionFeedbackCard';

interface ProposalFeedbackPanelProps {
  /** Anonymized reviewer notes released once their review phase ended. */
  feedbackItems: Array<ProposalFeedbackItem>;
  /** Translated by the caller — this panel takes no hooks. */
  title: string;
  subtitle: string;
}

export function ProposalFeedbackPanel({
  feedbackItems,
  title,
  subtitle,
}: ProposalFeedbackPanelProps) {
  return (
    <div className="flex flex-col gap-6 px-12 pt-12 pb-4">
      <div className="flex flex-col gap-4 border-b border-border pb-4">
        <Header3>{title}</Header3>

        <p className="text-base text-muted-foreground">{subtitle}</p>
      </div>

      {/* Fills in from a client query, with no navigation to announce it. */}
      <div aria-live="polite" className="flex flex-col gap-6">
        {feedbackItems.map((item) => (
          <RevisionFeedbackCard
            key={item.id}
            comment={item.comment}
            sentAt={item.submittedAt}
            variant="reviewer"
            meta="anonymousReviewer"
          />
        ))}
      </div>
    </div>
  );
}
