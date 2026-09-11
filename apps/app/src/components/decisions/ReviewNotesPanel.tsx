'use client';

import type {
  ProposalReviewRequest,
  ProposalRevisionNote,
} from '@op/common/client';

import { useTranslations } from '@/lib/i18n';

import { RevisionFeedbackCard } from './proposalEditor/RevisionFeedbackCard';

interface ReviewNotesPanelProps {
  /** Requests the author still has to answer, newest first. */
  openRequests: Array<ProposalReviewRequest>;
  /** Every past revision cycle, newest first. */
  noteGroups: Array<ProposalRevisionNote>;
  /** The viewer wrote the proposal, which is all that changes the note title. */
  isAuthor: boolean;
}

/**
 * The body of the "Review notes" sheet: one record per proposal, the same for
 * every viewer the sheet admits — the open revision requests, then every cycle
 * already answered, newest first. Requests are anonymous, so no reviewer is
 * named.
 */
export function ReviewNotesPanel({
  openRequests,
  noteGroups,
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

      {noteGroups.map((group) => (
        <div
          key={group.respondedProposalHistoryId}
          className="flex flex-col gap-4"
        >
          {/* A resubmission can carry no note, and then the cycle is just the
              requests it answered. */}
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
