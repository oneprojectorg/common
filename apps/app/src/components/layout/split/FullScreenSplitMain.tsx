import { CommonLogo } from '@/components/CommonLogo';
import { OPLogo } from '@/components/OPLogo';

export const FullScreenSplitMain = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  return (
    <main className="flex size-full flex-col p-4 sm:col-span-2 sm:p-8">
      <section className="hidden sm:block">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <OPLogo />
            <CommonLogo />
          </div>
        </div>
      </section>
      <section className="flex size-full items-center justify-center">
        <div className="py-20">{children}</div>
      </section>
    </main>
  );
};
