'use client';

import { match } from '@op/core';
import { Button } from '@op/sense/Button';
import { Spinner } from '@op/sense/Spinner';
import type { MouseEvent } from 'react';

import { useTranslations } from '@/lib/i18n';

import type { ProposalCardTranslation } from './useProposalCardTranslation';

/**
 * The per-card "See translation" link, shown above the title only when the
 * card's own text is in another language than the reader's.
 *
 * The wrapper is a polite live region that stays mounted across states, so a
 * screen reader hears "Translating..." and "Translated from Spanish" as they
 * land. `relative z-10` lifts it above the title's stretched link, and clicks
 * stop here so they never open the proposal or toggle an interactive card.
 */
export const ProposalTranslateLink = ({
  translation,
}: {
  translation: ProposalCardTranslation;
}) => {
  const t = useTranslations();
  const { isOffered, status, sourceLanguageName, translate, showOriginal } =
    translation;

  if (!isOffered) {
    return null;
  }

  const notice = match(status, {
    translated: t('decisions.proposals.translatedFromNotice', {
      language: sourceLanguageName,
    }),
    failed: t('decisions.proposals.translationFailedNotice'),
    _: null,
  });

  const onClick = (event: MouseEvent) => {
    event.stopPropagation();
    if (status === 'translated') {
      showOriginal();
    } else {
      translate();
    }
  };

  return (
    <div
      aria-live="polite"
      className="relative z-10 flex w-fit flex-wrap items-center gap-x-1 text-sm"
    >
      {/* Always rendered (possibly empty) so the button keeps its place in the
          tree and keyboard focus survives each state change. */}
      <span className="text-muted-foreground">{notice}</span>
      <Button
        variant="link"
        size="inline"
        className="text-sm font-normal"
        disabled={status === 'translating'}
        onClick={onClick}
      >
        {match(status, {
          translating: (
            <>
              <Spinner aria-hidden />
              {t('decisions.proposals.translatingProgress')}
            </>
          ),
          translated: t('decisions.proposals.viewOriginalAction'),
          failed: t('Try again'),
          _: t('decisions.proposals.seeTranslationAction'),
        })}
      </Button>
    </div>
  );
};
