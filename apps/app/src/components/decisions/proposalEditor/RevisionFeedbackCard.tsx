'use client';

import { useRelativeTime } from '@op/hooks';
import { cn } from '@op/ui/utils';

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
}

export function RevisionFeedbackCard({
  comment,
  sentAt,
  variant,
}: RevisionFeedbackCardProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-xl border border-border p-6',
        variant === 'author' && 'bg-primary-foreground',
      )}
    >
      <p
        className={cn(
          'text-base whitespace-pre-wrap text-foreground',
          variant === 'reviewer' && 'italic',
        )}
      >
        {comment}
      </p>
      {sentAt && <SentAtLine sentAt={sentAt} />}
    </div>
  );
}

function SentAtLine({ sentAt }: { sentAt: string }) {
  const t = useTranslations();
  const timeAgo = useRelativeTime(sentAt, { style: 'long' });

  return (
    <p className="text-sm text-muted-foreground">
      {t('Sent {timeAgo}', { timeAgo })}
    </p>
  );
}
