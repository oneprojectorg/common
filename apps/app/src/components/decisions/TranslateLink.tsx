'use client';

import { match } from '@op/core';
import { Button } from '@op/sense/Button';
import { Spinner } from '@op/sense/Spinner';
import { cn } from '@op/sense/lib/utils';
import type { MouseEvent } from 'react';

import { useTranslations } from '@/lib/i18n';

import { Bullet } from '../Bullet';
import type { TranslateLinkState } from './useTranslateLink';

/** `z-10` keeps it clickable above a card's stretched title link. */
export const TranslateLink = ({
  translation,
  align = 'start',
  inverse = false,
}: {
  translation: TranslateLinkState;
  align?: 'start' | 'center';
  inverse?: boolean;
}) => {
  const t = useTranslations();
  const { isOffered, status, sourceLanguageName, translate, showOriginal } =
    translation;

  if (!isOffered) {
    return null;
  }

  const { notice, label, action } = match(status, {
    translating: {
      notice: null,
      label: (
        <>
          <Spinner aria-hidden />
          {t('decisions.proposals.translatingProgress')}
        </>
      ),
      action: translate,
    },
    translated: {
      notice: (
        <>
          {t('decisions.proposals.translatedFromNotice', {
            language: sourceLanguageName,
          })}
          <Bullet />
        </>
      ),
      label: t('decisions.proposals.viewOriginalAction'),
      action: showOriginal,
    },
    failed: {
      notice: t('decisions.proposals.translationFailedNotice'),
      label: t('Try again'),
      action: translate,
    },
    _: {
      notice: null,
      label: t('decisions.proposals.seeTranslationAction'),
      action: translate,
    },
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
      )}
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
};
