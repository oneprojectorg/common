'use client';

import type {
  ProposalFeedbackItem,
  ProposalReviewRequest,
  ProposalRevisionNote,
} from '@op/common/client';

import { useTranslations } from '@/lib/i18n';

import { RevisionFeedbackCard } from './proposalEditor/RevisionFeedbackCard';

interface ReviewNotesPanelProps {
  openRequests: Array<ProposalReviewRequest>;
  noteGroups: Array<ProposalRevisionNote>;
  feedbackNotes: Array<ProposalFeedbackItem>;
  isAuthor: boolean;
}

/** Open revision requests, then reviewer notes, then the answered cycles. */
export function ReviewNotesPanel({
  openRequests,
  noteGroups,
  feedbackNotes,
  isAuthor,
}: ReviewNotesPanelProps) {
  const t = useTranslations();
  const noteTitle = isAuthor
    ? t('Your revision note')
    : t("Author's revision note");

  return (
    // Fills in from a client query, with no navigation to announce it.
    <div aria-live="polite" className="flex flex-col gap-4">
      {openRequests.length > 0 ? (
        <>
          <h3 className="font-serif text-label">
            {openRequests.length === 1
              ? t('Revision request')
              : t('Revision requests')}
          </h3>

          {openRequests.map((request) => (
            <RevisionFeedbackCard
              key={request.id}
              comment={request.requestComment}
              sentAt={request.requestedAt}
              variant="request"
              meta="bare"
            />
          ))}
        </>
      ) : null}

      {feedbackNotes.length > 0 ? (
        <>
          <h3 className="font-serif text-label">{t('Feedback')}</h3>

          <p className="text-base text-muted-foreground">
            {t('Notes reviewers shared while this proposal was under review')}
          </p>

          {feedbackNotes.map((item) => (
            <RevisionFeedbackCard
              key={item.id}
              comment={item.comment}
              sentAt={item.submittedAt}
              variant="reviewer"
              meta="anonymousReviewer"
            />
          ))}
        </>
      ) : null}

      {noteGroups.map((group) => (
        <div
          key={group.respondedProposalHistoryId}
          className="flex flex-col gap-4"
        >
          {/* A resubmission can carry no note. */}
          {group.responseComment ? (
            <RevisionFeedbackCard
              comment={group.responseComment}
              sentAt={group.respondedAt}
              variant="author"
              title={noteTitle}
              meta="bare"
            />
          ) : null}

          {group.requests.map((request) => (
            <RevisionFeedbackCard
              key={request.id}
              comment={request.requestComment}
              sentAt={request.requestedAt}
              variant="request"
              meta="bare"
            />
          ))}
        </div>
      ))}
    </div>
  );
}
