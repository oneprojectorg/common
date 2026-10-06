import { getStartLayoutUser } from '@/server/layouts.functions';
import { Outlet, createFileRoute } from '@tanstack/react-router';

import { getDestination } from '@/lib/destination';
import { useTranslations } from '@/lib/i18n';
import { Link } from '@/lib/i18n/routing';

import { CommonLogo } from '@/components/CommonLogo';
import { LocaleChooser } from '@/components/LocaleChooser';

export const Route = createFileRoute('/$locale/start')({
  loader: ({ location }) =>
    getStartLayoutUser({
      data: { pathname: getDestination(location).pathname },
    }),
  staleTime: Infinity,
  component: StartLayout,
});

function StartLayout() {
  const t = useTranslations();

  return (
    <div className="relative flex h-svh w-full flex-col items-center justify-center font-sans">
      <div id="top-slot" className="absolute top-0 w-full" />
      <main className="relative flex size-full flex-col overflow-y-scroll p-4 md:p-8">
        <section className="sticky top-0 z-10 flex items-center justify-end bg-background">
          <Link
            href="/"
            className="me-auto hidden items-center gap-2 hover:no-underline lg:flex"
          >
            <span className="sr-only">{t('Home')}</span>
            <CommonLogo />
          </Link>
          <LocaleChooser />
        </section>
        <section className="flex size-full flex-col items-center">
          <div className="flex flex-1 flex-col items-center py-7 sm:py-20">
            <Outlet />
          </div>
        </section>
      </main>
    </div>
  );
}
