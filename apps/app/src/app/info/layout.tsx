import { Link } from '@/lib/i18n/routing';

import { CommonLogo } from '@/components/CommonLogo';
import { TranslatedText } from '@/components/TranslatedText';

const InfoLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="relative flex h-svh w-full flex-col font-sans">
      <div id="top-slot" className="absolute top-0 w-full" />
      <main className="relative flex size-full flex-col overflow-y-scroll p-4 md:p-8">
        <section className="sticky top-0 hidden lg:block">
          <Link href="/" className="flex items-center gap-2 hover:no-underline">
            <span className="sr-only">
              <TranslatedText text="Home" />
            </span>
            <CommonLogo />
          </Link>
        </section>
        <section className="flex size-full flex-col items-center">
          <div className="py-7 sm:py-20">{children}</div>
        </section>
      </main>
    </div>
  );
};

export default InfoLayout;
