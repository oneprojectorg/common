import { Outlet, createFileRoute } from '@tanstack/react-router';

import { i18nConfig } from '@/lib/i18n/config';
import { notFound } from '@/lib/navigation';

export const Route = createFileRoute('/$locale')({
  // A bogus top-level path like /info.php lands here as locale "info.php";
  // it is a 404, not a page in some locale.
  beforeLoad: ({ params }) => {
    if (!i18nConfig.locales.some((locale) => locale === params.locale)) {
      notFound();
    }
  },
  component: Outlet,
});
