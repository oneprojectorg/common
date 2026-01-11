import Link from 'next/link';

import { CommonLogo } from '@/components/CommonLogo';

export const FullScreenSplitMain = ({
  logo = true,
  children,
}: {
  logo?: boolean;
  children: React.ReactNode;
}) => {
  return (
    <main className="p-4 md:p-8 lg:col-span-2 lg:max-w-[calc(100vw-24rem)] relative col-span-3 flex size-full flex-col overflow-y-scroll">
      <section className="top-0 lg:block sticky hidden">
        <div className="gap-2 flex items-center">
          {logo ? (
            <Link href="/" className="gap-2 flex items-center">
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
