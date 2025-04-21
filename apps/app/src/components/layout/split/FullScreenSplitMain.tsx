import { CommonLogo } from '@/components/CommonLogo';
import { OPLogo } from '@/components/OPLogo';

export const FullScreenSplitMain = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  return (
    <main className="flex size-full flex-col overflow-y-auto p-4 sm:col-span-2 sm:p-8">
      <section>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <OPLogo />
            <CommonLogo />
          </div>
        </div>
      </section>
      <section className="mt-20 flex size-full max-h-screen justify-center overflow-y-auto">
        {children}
      </section>
    </main>
  );
};
