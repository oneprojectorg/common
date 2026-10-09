'use client';

import { trpc } from '@op/api/client';
import {
  type Proposal,
  type ProposalTranslation,
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from '@op/common/client';
import { useLocale } from 'next-intl';
import { useCallback, useMemo, useState } from 'react';

import { baseLanguage, detectLanguages } from '@/lib/languageDetection';

import { useCardTranslation } from '../ProposalTranslationContext';
import { getProposalDetectionText } from '../translationDetectionText';

type CardTranslationStatus = 'idle' | 'translating' | 'translated' | 'failed';

export type ProposalCardTranslation = ReturnType<
  typeof useProposalCardTranslation
>;

/**
 * One card's own translation: detection, the request, and the cached result.
 *
 * Each card detects its own language, so a grid can offer translation on the
 * Spanish card and not on the English one beside it. The result is cached per
 * locale — "View original" then "See translation" again sends no second
 * request — and a list-level translation that already covers the card takes
 * precedence, so the link steps aside.
 */
export const useProposalCardTranslation = (proposal: Proposal) => {
  const locale = useLocale();
  const supportedLocale = (SUPPORTED_LOCALES as readonly string[]).includes(
    locale,
  )
    ? (locale as SupportedLocale)
    : null;
  const bulkTranslation = useCardTranslation(proposal.profileId);

  const detectionText = useMemo(
    () => getProposalDetectionText(proposal),
    [proposal],
  );
  // The detected language names the "Translated from" label too: the server's
  // `sourceLocale` is `UNKNOWN` for cached rows and for the OpenL provider.
  const sourceLanguage = useMemo(() => {
    const localeLanguage = baseLanguage(locale);
    return detectLanguages(detectionText).find(
      (language) => language !== localeLanguage,
    );
  }, [detectionText, locale]);

  const [status, setStatus] = useState<CardTranslationStatus>('idle');
  const [cached, setCached] = useState<{
    locale: string;
    translation: ProposalTranslation;
  } | null>(null);

  const translateMutation = trpc.translation.translateProposals.useMutation({
    onSuccess: (data, { targetLocale }) => {
      const translation = data.translations[proposal.profileId];
      // Nothing back for this card means nothing was translated — saying
      // "Translated from…" over the unchanged text would be wrong.
      if (!translation) {
        setStatus('failed');
        return;
      }
      setCached({ locale: targetLocale, translation });
      setStatus('translated');
    },
    onError: () => setStatus('failed'),
  });

  const translate = useCallback(() => {
    if (!supportedLocale) {
      return;
    }
    if (cached?.locale === supportedLocale) {
      setStatus('translated');
      return;
    }
    setStatus('translating');
    translateMutation.mutate({
      profileIds: [proposal.profileId],
      targetLocale: supportedLocale,
    });
  }, [cached, supportedLocale, translateMutation, proposal.profileId]);

  const showOriginal = useCallback(() => setStatus('idle'), []);

  const isOffered = !!supportedLocale && !!sourceLanguage && !bulkTranslation;
  // A result cached for another locale is stale — the reader switched language.
  const translation =
    isOffered && status === 'translated' && cached?.locale === locale
      ? cached.translation
      : undefined;
  const effectiveStatus: CardTranslationStatus =
    status === 'translated' && !translation ? 'idle' : status;

  // The browser's Intl API localizes the language name — no dictionary keys.
  const sourceLanguageName = useMemo(
    () =>
      sourceLanguage
        ? (new Intl.DisplayNames([locale], { type: 'language' }).of(
            sourceLanguage,
          ) ?? sourceLanguage)
        : '',
    [locale, sourceLanguage],
  );

  return {
    isOffered,
    status: effectiveStatus,
    sourceLanguageName,
    /** The card's translated text, set only while the translation is shown. */
    translation,
    translate,
    showOriginal,
  };
};
