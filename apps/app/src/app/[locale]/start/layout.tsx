import Link from 'next/link';

import { CommonLogo } from '@/components/CommonLogo';

const StartLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="relative flex h-svh w-full flex-col items-center justify-center font-sans">
      <div id="top-slot" className="absolute top-0 w-full" />
      <main className="relative flex size-full flex-col overflow-y-scroll p-4 md:p-8">
        <section className="sticky top-0 hidden lg:block">
          <div className="flex items-center gap-2">
            <Link href="/" className="flex items-center gap-2">
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
