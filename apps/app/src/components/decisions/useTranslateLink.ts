'use client';

import { useForeignContentLanguage } from '@/hooks/useForeignContentLanguage';
import { type SupportedLocale, isSupportedLocale } from '@op/common/client';
import { useLocale } from 'next-intl';
import { useMemo, useState } from 'react';

type TranslateLinkStatus = 'idle' | 'translating' | 'translated' | 'failed';

/** What `ProposalTranslateLink` renders from. */
export type TranslateLinkState = {
  isOffered: boolean;
  status: TranslateLinkStatus;
  sourceLanguageName: string;
  translate: () => void;
  showOriginal: () => void;
};

type CachedTranslation<T> = {
  locale: SupportedLocale;
  /** The text it was translated from — an edit makes the result stale. */
  source: string;
  translation: T;
};

/**
 * The "See translation" link's state for one proposal, on the card and on the
 * proposal page alike: detection, the request, and the cached result.
 *
 * The link is offered only when `detectionText` is in another language than
 * the reader's. The result is cached per locale and source text, so "View
 * original" then "See translation" again sends no second request. `request`
 * resolves to the translation, or `undefined` when nothing came back for this
 * proposal — shown as a failure, not as a translation of unchanged text.
 */
export const useTranslateLink = <T>({
  detectionText,
  enabled,
  request,
}: {
  detectionText: string;
  /** Off drops back to the original and hides the link. */
  enabled: boolean;
  request: (targetLocale: SupportedLocale) => Promise<T | undefined>;
}): TranslateLinkState & { translation: T | undefined } => {
  const locale = useLocale();
  const supportedLocale = isSupportedLocale(locale) ? locale : null;
  const isActive = enabled && !!supportedLocale;

  // The detected language names the "Translated from" label too: the server's
  // `sourceLocale` is `UNKNOWN` for cached rows and for the OpenL provider.
  const sourceLanguage = useForeignContentLanguage(
    isActive ? detectionText : '',
  );
  const sourceLanguageName = useLanguageName(sourceLanguage);

  const [status, setStatus] = useState<TranslateLinkStatus>('idle');
  const [cached, setCached] = useState<CachedTranslation<T> | null>(null);

  // Turned off (e.g. a list-level translation took over): drop back to the
  // original, so the list's "View original" doesn't leave this one translated.
  if (!isActive && status !== 'idle') {
    setStatus('idle');
  }

  // A response only lands if the link is still waiting on it: a takeover in
  // the meantime means the reader moved on.
  const settle = (next: TranslateLinkStatus) =>
    setStatus((current) => (current === 'translating' ? next : current));

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
    // The text as it was when asked — an edit landing mid-request makes the
    // result stale rather than current.
    const source = detectionText;
    request(supportedLocale).then(
      (translation) => {
        if (translation === undefined) {
          settle('failed');
          return;
        }
        setCached({ locale: supportedLocale, source, translation });
        settle('translated');
      },
      () => settle('failed'),
    );
  };

  const isOffered = isActive && !!sourceLanguage;
  const shown = getShownState({
    status,
    cached: isOffered && isCacheFresh ? cached : null,
  });

  return {
    isOffered,
    status: shown.status,
    sourceLanguageName,
    /** The translated content, set only while the translation is shown. */
    translation: shown.translation,
    translate,
    showOriginal: () => setStatus('idle'),
  };
};

/**
 * Whether `cached` still matches what is on screen: a result for another
 * locale, or for text since edited, is stale.
 */
const isFresh = <T>({
  cached,
  locale,
  source,
}: {
  cached: CachedTranslation<T> | null;
  locale: string;
  source: string;
}) => cached?.locale === locale && cached.source === source;

/**
 * The translation only while it is asked for and still fresh (`cached` is null
 * otherwise), and "idle" when it was asked for but has gone stale.
 */
const getShownState = <T>({
  status,
  cached,
}: {
  status: TranslateLinkStatus;
  cached: CachedTranslation<T> | null;
}): { status: TranslateLinkStatus; translation: T | undefined } => {
  if (status !== 'translated') {
    return { status, translation: undefined };
  }
  return cached
    ? { status, translation: cached.translation }
    : { status: 'idle', translation: undefined };
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
