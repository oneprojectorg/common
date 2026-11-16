'use client';

import { TranslateLink } from './TranslateLink';
import { RevisionFeedbackCard } from './proposalEditor/RevisionFeedbackCard';
import { useRevisionNoteTranslation } from './useRevisionNoteTranslation';

export function RevisionNoteCard({
  requestId,
  comment,
  respondedAt,
  title,
}: {
  requestId: string;
  comment: string;
  respondedAt: string | null;
  title: string;
}) {
  const translation = useRevisionNoteTranslation({ requestId, comment });

  return (
    <RevisionFeedbackCard
      comment={translation.translation ?? comment}
      sentAt={respondedAt}
      variant="author"
      title={title}
      meta="bare"
      translateLink={<TranslateLink translation={translation} />}
    />
  );
}
