'use client';

import { useRelativeTime } from '@op/hooks';
import { cn } from '@op/ui/utils';

import { useTranslations } from '@/lib/i18n';

interface RevisionFeedbackCardProps {
  comment: string;
  sentAt: string | null;
  /** When true, renders the comment in italic — used for reviewer feedback. */
  italic?: boolean;
  /** Tints the card with the teal+white surface used for the author's note. */
  tinted?: boolean;
}

export function RevisionFeedbackCard({
  comment,
  sentAt,
  italic = false,
  tinted = false,
}: RevisionFeedbackCardProps) {
  const t = useTranslations();
  const timeAgo = useRelativeTime(sentAt ?? new Date().toISOString(), {
    style: 'long',
  });

  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-xl border border-neutral-gray1 p-6',
        tinted && 'bg-primary-tealWhite',
      )}
    >
      <p
        className={cn(
          'text-base whitespace-pre-wrap text-neutral-charcoal',
          italic && 'italic',
        )}
      >
        {comment}
      </p>
      {sentAt && (
        <p className="text-sm text-neutral-gray4">
          {t('Sent {timeAgo}', { timeAgo })}
        </p>
      )}
    </div>
  );
}
