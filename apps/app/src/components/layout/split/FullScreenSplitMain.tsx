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
    <main className="col-span-3 flex size-full flex-col p-4 sm:p-8 lg:col-span-2">
      <section className="hidden lg:block">
        <div className="flex items-center gap-2">
          {logo ? (
            <Link href="/" className="flex items-center gap-2">
              <CommonLogo />
            </Link>
          ) : null}
        </div>
      </section>
      <section className="flex size-full justify-center sm:items-center">
        <div className="py-7 sm:py-20">{children}</div>
      </section>
    </main>
  );
};
