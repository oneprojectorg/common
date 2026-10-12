'use client';

import { TranslateLink as SenseTranslateLink } from '@op/sense/TranslateLink';

import { useTranslations } from '@/lib/i18n';

import type { TranslateLinkState } from './useTranslateLink';

export const TranslateLink = ({
  translation,
  align,
  inverse,
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

  return (
    <SenseTranslateLink
      status={status}
      onTranslate={translate}
      onShowOriginal={showOriginal}
      translatedNotice={t('decisions.proposals.translatedFromNotice', {
        language: sourceLanguageName,
      })}
      translateLabel={t('decisions.proposals.seeTranslationAction')}
      translatingLabel={t('decisions.proposals.translatingProgress')}
      showOriginalLabel={t('decisions.proposals.viewOriginalAction')}
      failedNotice={t('decisions.proposals.translationFailedNotice')}
      retryLabel={t('Try again')}
      align={align}
      inverse={inverse}
    />
  );
};
