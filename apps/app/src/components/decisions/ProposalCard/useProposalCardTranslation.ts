'use client';

import { useForeignContentLanguage } from '@/hooks/useContentNeedsTranslation';
import { trpc } from '@op/api/client';
import {
  type Proposal,
  type ProposalTranslation,
  type SupportedLocale,
  isSupportedLocale,
} from '@op/common/client';
import { useLocale } from 'next-intl';
import { type Dispatch, type SetStateAction, useMemo, useState } from 'react';

import { useCardTranslation } from '../ProposalTranslationContext';
import { getProposalDetectionText } from '../translationDetectionText';

type CardTranslationStatus = 'idle' | 'translating' | 'translated' | 'failed';

type CachedTranslation = {
  locale: SupportedLocale;
  /** The text it was translated from — an edit makes the result stale. */
  source: string;
  translation: ProposalTranslation;
};

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
  const [cached, setCached] = useState<CachedTranslation | null>(null);

  // A list-level translation took over: drop back to the original, so the
  // list's "View original" doesn't leave this one card translated.
  if (bulkTranslation && status !== 'idle') {
    setStatus('idle');
  }

  const requestTranslation = useTranslationRequest({
    profileId: proposal.profileId,
    setStatus,
    setCached,
  });

  const isCacheFresh = isFresh({ cached, locale, source: detectionText });

  const translate = () => {
    if (!supportedLocale) {
      return;
    }
    if (isCacheFresh) {
      setStatus('translated');
      return;
    }
    setStatus('translating');
    requestTranslation({ locale: supportedLocale, source: detectionText });
  };

  const isOffered = isActive && !!sourceLanguage;
  const shown = getShownState({
    status,
    cached: isOffered && isCacheFresh ? cached : null,
  });

  const sourceLanguageName = useLanguageName(sourceLanguage);

  return {
    isOffered,
    status: shown.status,
    sourceLanguageName,
    /** The card's translated text, set only while the translation is shown. */
    translation: shown.translation,
    translate,
    showOriginal: () => setStatus('idle'),
  };
};

/**
 * Whether `cached` still matches what the card shows: a result for another
 * locale, or for text since edited, is stale.
 */
const isFresh = ({
  cached,
  locale,
  source,
}: {
  cached: CachedTranslation | null;
  locale: string;
  source: string;
}) => cached?.locale === locale && cached.source === source;

/**
 * What the card shows: the translation only while it is asked for and still
 * fresh (`cached` is null otherwise), and "idle" when a translation was asked
 * for but has gone stale.
 */
const getShownState = ({
  status,
  cached,
}: {
  status: CardTranslationStatus;
  cached: CachedTranslation | null;
}): {
  status: CardTranslationStatus;
  translation: ProposalTranslation | undefined;
} => {
  if (status !== 'translated') {
    return { status, translation: undefined };
  }
  return cached
    ? { status, translation: cached.translation }
    : { status: 'idle', translation: undefined };
};

/**
 * Sends one card's translation request and settles the card from the response.
 */
const useTranslationRequest = ({
  profileId,
  setStatus,
  setCached,
}: {
  profileId: string;
  setStatus: Dispatch<SetStateAction<CardTranslationStatus>>;
  setCached: Dispatch<SetStateAction<CachedTranslation | null>>;
}) => {
  const translateMutation = trpc.translation.translateProposals.useMutation();

  // A response only lands if the card is still waiting on it: a list-level
  // takeover in the meantime means the reader moved on.
  const settle = (next: CardTranslationStatus) =>
    setStatus((current) => (current === 'translating' ? next : current));

  // `source` is the text as it was when asked, so an edit landing mid-request
  // makes the result stale rather than current.
  return ({ locale, source }: { locale: SupportedLocale; source: string }) =>
    translateMutation.mutate(
      { profileIds: [profileId], targetLocale: locale },
      {
        onSuccess: (data) => {
          const translation = data.translations[profileId];
          // Nothing back for this card means nothing was translated — saying
          // "Translated from…" over the unchanged text would be wrong.
          if (!translation) {
            settle('failed');
            return;
          }
          setCached({ locale, source, translation });
          settle('translated');
        },
        onError: () => settle('failed'),
      },
    );
};

/** `language`'s name in the reader's locale, or '' when there is none. */
const useLanguageName = (language: string | undefined) => {
  const locale = useLocale();

  // The browser's Intl API localizes the language name — no dictionary keys.
  return useMemo(() => {
    if (!language) {
      return '';
    }
    const names = new Intl.DisplayNames([locale], { type: 'language' });
    return names.of(language) ?? language;
  }, [locale, language]);
};
