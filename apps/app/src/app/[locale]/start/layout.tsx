import { getUser } from '@/utils/getUser';
import { assertWalledGardenAccess } from '@/utils/walledGarden';

import { getTranslations } from '@/lib/i18n';
import { Link } from '@/lib/i18n/routing';

import { CommonLogo } from '@/components/CommonLogo';
import { LocaleChooser } from '@/components/LocaleChooser';

const StartLayout = async ({ children }: { children: React.ReactNode }) => {
  const [t, user] = await Promise.all([getTranslations(), getUser()]);

  // Admit any real account: non-members belong in onboarding, and gating them
  // out only deadlocks returning users. Real protection is in the service layer.
  await assertWalledGardenAccess(user, { allowNonMembers: true });

  return (
    <div className="relative flex h-svh w-full flex-col items-center justify-center font-sans">
      <div id="top-slot" className="absolute top-0 w-full" />
      <main className="relative flex size-full flex-col overflow-y-scroll p-4 md:p-8">
        {/* The logo stays desktop-only, but the chooser shows at every width:
            onboarding is the first localized screen a new account sees, and
            most of it happens on a phone. */}
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
            {children}
          </div>
        </section>
      </main>
    </div>
  );
};

export default StartLayout;
