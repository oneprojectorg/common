'use client';

import { cn } from '@op/sense/lib/utils';

import { useTranslations } from '@/lib/i18n';

interface CharacterCounterProps {
  /** Referenced by the control's `aria-describedby`. */
  id: string;
  count: number;
  max: number;
  className?: string;
}

/**
 * Live `37/50` character counter rendered inside a field's control box.
 *
 * Announcement strategy: the digits themselves are `aria-hidden` and paired
 * with a screen-reader-only sentence. Because that sentence sits in a plain
 * (non-live) element wired through `aria-describedby`, it is read once when the
 * control takes focus instead of on every keystroke. Only crossing the limit is
 * announced live, via a polite `role="status"`.
 */
export function CharacterCounter({
  id,
  count,
  max,
  className,
}: CharacterCounterProps) {
  const t = useTranslations();
  const isAtLimit = count >= max;

  return (
    <>
      <span
        id={id}
        className={cn(
          'text-sm text-muted-foreground tabular-nums',
          isAtLimit && 'text-destructive',
          className,
        )}
      >
        {/* Digits stay LTR so "37/50" doesn't reorder in RTL locales. */}
        <span aria-hidden="true" dir="ltr">
          {count}/{max}
        </span>
        <span className="sr-only">
          {t('{count} of {max} characters used', { count, max })}
        </span>
      </span>
      <span role="status" className="sr-only">
        {isAtLimit ? t('Character limit reached') : ''}
      </span>
    </>
  );
}
