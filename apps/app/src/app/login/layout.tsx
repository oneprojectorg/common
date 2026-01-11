import { FullScreenSplitAside } from '@/components/layout/split/FullScreenSplitAside';
import { FullScreenSplitLayout } from '@/components/layout/split/FullScreenSplitLayout';
import { FullScreenSplitMain } from '@/components/layout/split/FullScreenSplitMain';

const LoginLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <FullScreenSplitLayout>
      <div id="top-slot" className="top-0 sm:w-2/3 absolute w-full" />
      <FullScreenSplitMain logo={false}>{children}</FullScreenSplitMain>
      <FullScreenSplitAside />
    </FullScreenSplitLayout>
  );
};

export default LoginLayout;
