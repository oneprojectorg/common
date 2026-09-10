'use client';

import type { ProposalReviewRequest } from '@op/common/client';

import { useTranslations } from '@/lib/i18n';

import { RevisionFeedbackCard } from './proposalEditor/RevisionFeedbackCard';

export interface ProposalRevisionNote {
  comment: string;
  respondedAt: string | null;
}

interface ReviewNotesPanelProps {
  /** The revision requests listed as cards, newest first. */
  requests: Array<ProposalReviewRequest>;
  /** The author's note, shown above the requests it answered. */
  note?: ProposalRevisionNote | null;
}

/**
 * The body of the "Review notes" sheet: every revision request the author has
 * to answer, or — once they have resubmitted — their note above the requests it
 * answered. Requests are anonymous, so no reviewer is named.
 */
export function ReviewNotesPanel({ requests, note }: ReviewNotesPanelProps) {
  const t = useTranslations();

  return (
    // Fills in from a client query, with no navigation to announce it.
    <div aria-live="polite" className="flex flex-col gap-4">
      <h3 className="font-serif text-label">
        {requests.length === 1 ? t('Revision request') : t('Revision requests')}
      </h3>

      {note ? (
        <RevisionFeedbackCard
          comment={note.comment}
          sentAt={note.respondedAt}
          variant="author"
          title={t('Your revision note')}
          meta="bare"
        />
      ) : null}

      {requests.map((request) => (
        <RevisionFeedbackCard
          key={request.id}
          comment={request.requestComment}
          sentAt={request.requestedAt}
          variant="request"
          meta="bare"
        />
      ))}
    </div>
  );
}
