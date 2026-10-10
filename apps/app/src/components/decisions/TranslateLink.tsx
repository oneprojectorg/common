'use client';

import { match } from '@op/core';
import { Button } from '@op/sense/Button';
import { Spinner } from '@op/sense/Spinner';
import { cn } from '@op/sense/lib/utils';
import type { MouseEvent } from 'react';

import { useTranslations } from '@/lib/i18n';

import { Bullet } from '../Bullet';
import type { TranslateLinkState } from './useTranslateLink';

/**
 * The "See translation" link for one authored object — a proposal, a comment,
 * a review, a revision request, the process overview. It sits at the top of
 * the object's content, above everything the author wrote, and shows only when
 * that object's own text is in another language than the reader's.
 *
 * The wrapper is a polite live region that stays mounted across states, so a
 * screen reader hears "Translating..." and "Translated from Spanish" as they
 * land. `relative z-10` lifts it above the title's stretched link, and clicks
 * stop here so they never open the proposal or toggle an interactive card.
 */
export const TranslateLink = ({
  translation,
  align = 'start',
}: {
  translation: TranslateLinkState;
  /** The alignment of the text under it — `center` on the overview banner. */
  align?: 'start' | 'center';
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
      {/* Always rendered (possibly empty) so the button keeps its place in the
          tree and keyboard focus survives each state change. */}
      <span className="flex items-center gap-1 text-muted-foreground empty:hidden">
        {notice}
      </span>
      <Button
        variant="link"
        size="inline"
        className="text-sm font-normal"
        disabled={status === 'translating'}
        // Keep focus on the button while it waits, so a keyboard user lands
        // on "View original" when the translation arrives.
        focusableWhenDisabled
        onClick={onClick}
      >
        {label}
      </Button>
    </div>
  );
};
