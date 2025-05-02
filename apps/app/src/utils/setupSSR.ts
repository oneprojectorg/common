import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { routing } from '@/lib/i18n';

export const setupSSR = async ({
  params,
}: {
  params: Promise<{ locale: string }>;
}) => {
  const { locale } = await params;
  if (!routing.locales.includes(locale as any)) {
    notFound();
  }

  // Set server-side next-intl locale
  setRequestLocale(locale);
};
