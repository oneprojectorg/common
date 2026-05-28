'use client';

import { useLocale } from 'next-intl';
import { useEffect } from 'react';

import { getLocaleDirection } from '@/lib/i18n/config';

export function LocaleDirSync() {
  const locale = useLocale();

  useEffect(() => {
    const root = document.documentElement;
    root.lang = locale;
    root.dir = getLocaleDirection(locale);
  }, [locale]);

  return null;
}
