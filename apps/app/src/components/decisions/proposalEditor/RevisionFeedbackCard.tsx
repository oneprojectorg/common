'use client';

import { useRelativeTime } from '@op/hooks';
import { cn } from '@op/sense/lib/utils';

import { useTranslations } from '@/lib/i18n';

interface RevisionFeedbackCardProps {
  comment: string;
  sentAt: string | null;
  /**
   * `reviewer` styles the comment in italic (reviewer feedback).
   * `request` is the plain bordered card the review-notes sheet lists.
   * `author` tints the card with the muted surface used for the author's note.
   */
  variant: 'reviewer' | 'request' | 'author';
  /** Heading above the comment, e.g. "Your revision note". */
  title?: string;
  /**
   * How the timestamp line reads: `sent` → "Sent 3 days ago",
   * `anonymousReviewer` → "Reviewer · 3 days ago", `bare` → "3 days ago".
   */
  meta?: 'sent' | 'anonymousReviewer' | 'bare';
}

export function RevisionFeedbackCard({
  comment,
  sentAt,
  variant,
  title,
  meta = 'sent',
}: RevisionFeedbackCardProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-xl border p-6',
        variant === 'author' && 'gap-3 bg-muted',
      )}
    >
      {title ? <h4 className="font-serif text-label">{title}</h4> : null}

      <p
        dir="auto"
        className={cn(
          'text-base whitespace-pre-wrap',
          variant === 'reviewer' && 'italic',
        )}
      >
        {comment}
      </p>
      {sentAt && <SentAtLine sentAt={sentAt} meta={meta} />}
    </div>
  );
}

function SentAtLine({
  sentAt,
  meta,
}: {
  sentAt: string;
  meta: 'sent' | 'anonymousReviewer' | 'bare';
}) {
  const t = useTranslations();
  const timeAgo = useRelativeTime(sentAt, { style: 'long' });

  return (
    <p className="text-sm text-muted-foreground">
      {meta === 'anonymousReviewer'
        ? t('Reviewer · {timeAgo}', { timeAgo })
        : meta === 'bare'
          ? timeAgo
          : t('Sent {timeAgo}', { timeAgo })}
    </p>
  );
}
