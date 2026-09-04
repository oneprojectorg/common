'use client';

import { useRelativeTime } from '@op/hooks';
import { cn } from '@op/sense/lib/utils';

import { useTranslations } from '@/lib/i18n';

interface RevisionFeedbackCardProps {
  comment: string;
  sentAt: string | null;
  /**
   * `reviewer` styles the comment in italic (reviewer feedback).
   * `author` tints the card with the teal+white surface used for the
   * author's note.
   */
  variant: 'reviewer' | 'author';
  /** Meta line reads "Reviewer · {time}" instead of "Sent {time}". */
  anonymousReviewer?: boolean;
}

export function RevisionFeedbackCard({
  comment,
  sentAt,
  variant,
  anonymousReviewer = false,
}: RevisionFeedbackCardProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-xl border p-6',
        variant === 'author' && 'bg-accent',
      )}
    >
      <p
        dir="auto"
        className={cn(
          'text-base whitespace-pre-wrap',
          variant === 'reviewer' && 'italic',
        )}
      >
        {comment}
      </p>
      {sentAt && (
        <SentAtLine sentAt={sentAt} anonymousReviewer={anonymousReviewer} />
      )}
    </div>
  );
}

function SentAtLine({
  sentAt,
  anonymousReviewer,
}: {
  sentAt: string;
  anonymousReviewer: boolean;
}) {
  const t = useTranslations();
  const timeAgo = useRelativeTime(sentAt, { style: 'long' });

  return (
    <p className="text-sm text-muted-foreground">
      {anonymousReviewer
        ? t('Reviewer · {timeAgo}', { timeAgo })
        : t('Sent {timeAgo}', { timeAgo })}
    </p>
  );
}
