'use client';

import { useForeignContentLanguage } from '@/hooks/useContentNeedsTranslation';
import { trpc } from '@op/api/client';
import {
  type Proposal,
  type ProposalTranslation,
  isSupportedLocale,
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
export const useProposalCardTranslation = ({
  proposal,
  enabled = true,
}: {
  proposal: Proposal;
  /** Off where the card can't host the link (the whole card is a control). */
  enabled?: boolean;
}) => {
  const locale = useLocale();
  const supportedLocale = isSupportedLocale(locale) ? locale : null;
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
    /** The text it was translated from — an edit makes the result stale. */
    source: string;
    translation: ProposalTranslation;
  } | null>(null);

  // A list-level translation took over: drop back to the original, so the
  // list's "View original" doesn't leave this one card translated.
  if (bulkTranslation && status !== 'idle') {
    setStatus('idle');
  }

  const translateMutation = trpc.translation.translateProposals.useMutation();

  // A response only lands if the card is still waiting on it: a list-level
  // takeover in the meantime means the reader moved on.
  const settle = (next: CardTranslationStatus) =>
    setStatus((current) => (current === 'translating' ? next : current));

  const isCacheFresh =
    cached?.locale === locale && cached.source === detectionText;

  const translate = () => {
    if (!supportedLocale) {
      return;
    }
    if (isCacheFresh) {
      setStatus('translated');
      return;
    }
    setStatus('translating');
    // The text as it was when asked — an edit landing mid-request makes the
    // result stale rather than current.
    const source = detectionText;
    translateMutation.mutate(
      { profileIds: [proposal.profileId], targetLocale: supportedLocale },
      {
        onSuccess: (data) => {
          const translation = data.translations[proposal.profileId];
          // Nothing back for this card means nothing was translated — saying
          // "Translated from…" over the unchanged text would be wrong.
          if (!translation) {
            settle('failed');
            return;
          }
          setCached({ locale: supportedLocale, source, translation });
          settle('translated');
        },
        onError: () => settle('failed'),
      },
    );
  };

  const isOffered = isActive && !!sourceLanguage;
  // A result cached for another locale or older text is stale.
  const translation =
    isOffered && status === 'translated' && isCacheFresh
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
