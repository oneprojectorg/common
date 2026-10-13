'use client';

import { useForeignContentLanguage } from '@/hooks/useForeignContentLanguage';
import { type SupportedLocale, isSupportedLocale } from '@op/common/client';
import { useLocale } from 'next-intl';
import { useMemo, useState } from 'react';

type TranslateLinkStatus = 'idle' | 'translating' | 'translated' | 'failed';

export type TranslateLinkState = {
  isOffered: boolean;
  status: TranslateLinkStatus;
  sourceLanguageName: string;
  translate: () => void;
  showOriginal: () => void;
};

type CachedTranslation<T> = {
  locale: SupportedLocale;
  source: string;
  translation: T;
};

/** One authored object's "See translation" state: detection, request and a per-locale cache. */
export const useTranslateLink = <T>({
  detectionText,
  enabled,
  request,
}: {
  detectionText: string;
  enabled: boolean;
  request: (targetLocale: SupportedLocale) => Promise<T | undefined>;
}): TranslateLinkState & { translation: T | undefined } => {
  const locale = useLocale();
  const supportedLocale = isSupportedLocale(locale) ? locale : null;
  const isActive = enabled && !!supportedLocale;

  // The server's `sourceLocale` can be UNKNOWN, so the label uses detection.
  const sourceLanguage = useForeignContentLanguage(
    isActive ? detectionText : '',
  );
  const sourceLanguageName = useLanguageName(sourceLanguage);

  const [status, setStatus] = useState<TranslateLinkStatus>('idle');
  const [cached, setCached] = useState<CachedTranslation<T> | null>(null);

  if (!isActive && status !== 'idle') {
    setStatus('idle');
  }

  // Ignore a response that lands after the link was turned off.
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
    translation: shown.translation,
    translate,
    showOriginal: () => setStatus('idle'),
  };
};

const isFresh = <T>({
  cached,
  locale,
  source,
}: {
  cached: CachedTranslation<T> | null;
  locale: string;
  source: string;
}) => cached?.locale === locale && cached.source === source;

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

const useLanguageName = (language: string | undefined) => {
  const locale = useLocale();

  return useMemo(() => {
    if (!language) {
      return '';
    }
    const names = new Intl.DisplayNames([locale], { type: 'language' });
    return names.of(language) ?? language;
  }, [locale, language]);
};
