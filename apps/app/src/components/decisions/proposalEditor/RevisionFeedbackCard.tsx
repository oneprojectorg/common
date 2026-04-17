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
        'flex flex-col gap-2 rounded-xl border border-neutral-gray1 p-6',
        variant === 'author' && 'bg-primary-tealWhite',
      )}
    >
      <p
        className={cn(
          'text-base whitespace-pre-wrap text-neutral-charcoal',
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
    <p className="text-sm text-neutral-gray4">
      {t('Sent {timeAgo}', { timeAgo })}
    </p>
  );
}
