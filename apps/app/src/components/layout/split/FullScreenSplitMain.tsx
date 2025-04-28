import { CommonLogo } from '@/components/CommonLogo';
import { OPLogo } from '@/components/OPLogo';

export const FullScreenSplitMain = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  return (
    <main className="col-span-3 flex size-full flex-col p-4 sm:p-8 lg:col-span-2">
      <section className="hidden lg:block">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <OPLogo />
            <CommonLogo />
          </div>
        </div>
      </section>
      <section className="flex size-full justify-center sm:items-center">
        <div className="py-20">{children}</div>
      </section>
    </main>
  );
};
