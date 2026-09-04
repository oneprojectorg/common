import { getTranslations } from '@/lib/i18n';
import { Link } from '@/lib/i18n/routing';

import { CommonLogo } from '@/components/CommonLogo';

export const FullScreenSplitMain = async ({
  logo = true,
  children,
}: {
  logo?: boolean;
  children: React.ReactNode;
}) => {
  const t = await getTranslations();

  return (
    <main className="relative col-span-3 flex size-full flex-col overflow-y-scroll p-4 md:p-8">
      <section className="sticky top-0 hidden lg:block">
        <div className="flex items-center gap-2">
          {logo ? (
            <Link
              href="/"
              className="flex items-center gap-2 hover:no-underline"
            >
              <span className="sr-only">{t('Home')}</span>
              <CommonLogo />
            </Link>
          ) : null}
        </div>
      </section>
      <section className="flex size-full flex-col items-center">
        <div className="py-7 sm:py-20">{children}</div>
      </section>
    </main>
  );
};
