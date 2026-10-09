'use client';

import { useForeignContentLanguage } from '@/hooks/useContentNeedsTranslation';
import { trpc } from '@op/api/client';
import {
  type Proposal,
  type ProposalTranslation,
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from '@op/common/client';
import { useLocale } from 'next-intl';
import { useMemo, useState } from 'react';

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
 * request. A list-level translation that already covers the card wins: the
 * link steps aside and detection is skipped.
 */
export const useProposalCardTranslation = (
  proposal: Proposal,
  { enabled = true }: { enabled?: boolean } = {},
) => {
  const locale = useLocale();
  const supportedLocale = (SUPPORTED_LOCALES as readonly string[]).includes(
    locale,
  )
    ? (locale as SupportedLocale)
    : null;
  const bulkTranslation = useCardTranslation(proposal.profileId);
  const isActive = enabled && !!supportedLocale && !bulkTranslation;

  const detectionText = useMemo(
    () => (isActive ? getProposalDetectionText(proposal) : ''),
    [isActive, proposal],
  );
  // The detected language names the "Translated from" label too: the server's
  // `sourceLocale` is `UNKNOWN` for cached rows and for the OpenL provider.
  const sourceLanguage = useForeignContentLanguage(detectionText);

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

  const translate = () => {
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
  };

  const isOffered = isActive && !!sourceLanguage;
  // A result cached for another locale is stale — the reader switched language.
  const translation =
    isOffered && status === 'translated' && cached?.locale === locale
      ? cached.translation
      : undefined;

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
    status: status === 'translated' && !translation ? 'idle' : status,
    sourceLanguageName,
    /** The card's translated text, set only while the translation is shown. */
    translation,
    translate,
    showOriginal: () => setStatus('idle'),
  };
};
