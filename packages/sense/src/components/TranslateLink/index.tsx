'use client';

import type { ComponentProps, MouseEvent, ReactNode } from 'react';

import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Spinner } from '../ui/spinner';

export type TranslateLinkStatus =
  | 'idle'
  | 'translating'
  | 'translated'
  | 'failed';

export interface TranslateLinkProps extends Omit<
  ComponentProps<'div'>,
  'children'
> {
  status: TranslateLinkStatus;
  onTranslate: () => void;
  onShowOriginal: () => void;
  /** Shown before the "show original" action once translated, e.g. "Translated from Spanish". */
  translatedNotice?: string;
  translateLabel?: string;
  translatingLabel?: string;
  showOriginalLabel?: string;
  failedNotice?: string;
  retryLabel?: string;
  /** Match the alignment of the text it sits above. */
  align?: 'start' | 'center';
  /** White text, for use over a dark image scrim. */
  inverse?: boolean;
}

/**
 * The "See translation" control at the top of a piece of user-written content.
 * A link-styled button that cycles through translate → translating → translated
 * (with a way back to the original) or failed (with a retry). It sits above
 * a card's stretched title link and swallows its own clicks.
 */
export function TranslateLink({
  status,
  onTranslate,
  onShowOriginal,
  translatedNotice = 'Translated',
  translateLabel = 'See translation',
  translatingLabel = 'Translating...',
  showOriginalLabel = 'View original',
  failedNotice = 'Translation failed.',
  retryLabel = 'Try again',
  align = 'start',
  inverse = false,
  className,
  ...rest
}: TranslateLinkProps) {
  const { notice, label, action } = getStateCopy({
    status,
    onTranslate,
    onShowOriginal,
    translatedNotice,
    translateLabel,
    translatingLabel,
    showOriginalLabel,
    failedNotice,
    retryLabel,
  });

  const onClick = (event: MouseEvent) => {
    event.stopPropagation();
    action();
  };

  return (
    <div
      aria-live="polite"
      className={cn(
        'relative z-10 flex w-fit flex-wrap items-center gap-x-1 text-sm',
        align === 'center' && 'mx-auto justify-center',
        className,
      )}
      {...rest}
    >
      {/* Always rendered so the button keeps keyboard focus across states. */}
      <span
        className={cn(
          'flex items-center gap-1 empty:hidden',
          inverse ? 'text-white' : 'text-muted-foreground',
        )}
      >
        {notice}
      </span>
      <Button
        variant="link"
        size="inline"
        className={cn('text-sm font-normal', inverse && 'text-white underline')}
        disabled={status === 'translating'}
        focusableWhenDisabled
        onClick={onClick}
      >
        {label}
      </Button>
    </div>
  );
}

function getStateCopy({
  status,
  onTranslate,
  onShowOriginal,
  translatedNotice,
  translateLabel,
  translatingLabel,
  showOriginalLabel,
  failedNotice,
  retryLabel,
}: Required<
  Omit<TranslateLinkProps, keyof ComponentProps<'div'> | 'align' | 'inverse'>
>): { notice: ReactNode; label: ReactNode; action: () => void } {
  switch (status) {
    case 'translating':
      return {
        notice: null,
        label: (
          <>
            <Spinner aria-hidden />
            {translatingLabel}
          </>
        ),
        action: onTranslate,
      };
    case 'translated':
      return {
        notice: (
          <>
            {translatedNotice}
            <span aria-hidden>•</span>
          </>
        ),
        label: showOriginalLabel,
        action: onShowOriginal,
      };
    case 'failed':
      return { notice: failedNotice, label: retryLabel, action: onTranslate };
    default:
      return { notice: null, label: translateLabel, action: onTranslate };
  }
}
