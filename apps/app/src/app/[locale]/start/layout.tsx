import { getUser } from '@/utils/getUser';
import { assertWalledGardenAccess } from '@/utils/walledGarden';
import { headers } from 'next/headers';

import { Link } from '@/lib/i18n/routing';

import { CommonLogo } from '@/components/CommonLogo';
import { TranslatedText } from '@/components/TranslatedText';

const StartLayout = async ({ children }: { children: React.ReactNode }) => {
  const user = await getUser();

  // Layouts don't get searchParams; read the query string the proxy exposes via
  // x-search. The promote flow runs as non-network-members, so admit them past
  // the gate.
  const search = (await headers()).get('x-search') ?? '';
  const isPromoteFlow = new URLSearchParams(search).get('promote') === 'true';

  // Onboarding is inside the walled garden.
  await assertWalledGardenAccess(user, {
    allowNonNetworkMembers: isPromoteFlow,
  });

  return (
    <div className="relative flex h-svh w-full flex-col items-center justify-center font-sans">
      <div id="top-slot" className="absolute top-0 w-full" />
      <main className="relative flex size-full flex-col overflow-y-scroll p-4 md:p-8">
        <section className="sticky top-0 hidden lg:block">
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="flex items-center gap-2 hover:no-underline"
            >
              <span className="sr-only">
                <TranslatedText text="Home" />
              </span>
              <CommonLogo />
            </Link>
          </div>
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
