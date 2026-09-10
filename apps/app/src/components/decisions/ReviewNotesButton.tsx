'use client';

import { Button } from '@op/sense/Button';
import { LuNotebookText } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

interface ReviewNotesButtonProps {
  onToggle: () => void;
  /** Whether the review-notes sheet is currently showing. */
  isExpanded: boolean;
  /** Marks the button with a dot until the author has opened the sheet once. */
  hasUnread: boolean;
}

/**
 * Header disclosure for the review-notes sheet (Figma: outline button, label
 * visible, unread dot on the inline-end corner).
 */
export function ReviewNotesButton({
  onToggle,
  isExpanded,
  hasUnread,
}: ReviewNotesButtonProps) {
  const t = useTranslations();
  const label = t('Review notes');

  return (
    <div className="relative flex">
      <Button
        variant="outline"
        onClick={onToggle}
        aria-label={label}
        aria-expanded={isExpanded}
        className="max-sm:size-11"
      >
        <LuNotebookText className="size-4" />
        <span className="hidden sm:inline">{label}</span>
      </Button>
      {hasUnread ? (
        <span
          role="img"
          aria-label={t('Unread review notes')}
          className="absolute -end-1 -top-1 size-3 rounded-full border-2 border-background bg-destructive"
        />
      ) : null}
    </div>
  );
}
