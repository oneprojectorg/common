import { FullScreenSplitAside } from '@/components/layout/split/FullScreenSplitAside';
import { FullScreenSplitLayout } from '@/components/layout/split/FullScreenSplitLayout';
import { FullScreenSplitMain } from '@/components/layout/split/FullScreenSplitMain';

const LoginLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <FullScreenSplitLayout>
      <div id="top-slot" className="absolute top-0 w-full sm:w-2/3" />
      <FullScreenSplitMain logo={false}>{children}</FullScreenSplitMain>
      <FullScreenSplitAside />
    </FullScreenSplitLayout>
  );
};

export default LoginLayout;
