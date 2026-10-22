'use client';

import { getLocaleDirection } from '@op/common/locales';
import { useLocale } from 'next-intl';
import { useEffect } from 'react';

export function LocaleDirSync() {
  const locale = useLocale();

  useEffect(() => {
    const root = document.documentElement;
    root.lang = locale;
    root.dir = getLocaleDirection(locale);
  }, [locale]);

  return null;
}
