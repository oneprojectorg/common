import { CommonLogo } from '@/components/CommonLogo';
import { FullScreenSplitAside } from '@/components/layout/split/FullScreenSplitAside';
import { FullScreenSplitLayout } from '@/components/layout/split/FullScreenSplitLayout';
import { FullScreenSplitMain } from '@/components/layout/split/FullScreenSplitMain';
import { OPLogo } from '@/components/OPLogo';

const LoginLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="relative flex h-svh w-full flex-col items-center justify-center font-sans">
      <div className="size-full">
        <div className="flex size-full max-h-full flex-col overflow-hidden">
          <div className="relative flex min-h-0 grow flex-col">
            <FullScreenSplitLayout>
              <div id="top-slot" className="absolute top-0 w-2/3" />
              <FullScreenSplitMain>
                <section>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2">
                      <OPLogo />
                      <CommonLogo />
                    </div>
                  </div>
                </section>
                <section className="flex size-full items-center justify-center">
                  {children}
                </section>
              </FullScreenSplitMain>
              <FullScreenSplitAside />
            </FullScreenSplitLayout>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginLayout;
