'use client';

import { useLocale } from 'next-intl';
import { I18nProvider } from 'react-aria';
import { RouterProvider } from 'react-aria-components';

import { useRouter } from '@/lib/i18n/routing';

export function ReactAriaRouterProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const locale = useLocale();

  return (
    <I18nProvider locale={locale}>
      <RouterProvider navigate={router.push}>{children}</RouterProvider>
    </I18nProvider>
  );
}
