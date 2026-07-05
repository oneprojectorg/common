import { FullScreenSplitLayout } from '@/components/layout/split/FullScreenSplitLayout';
import { FullScreenSplitMain } from '@/components/layout/split/FullScreenSplitMain';

export const dynamic = 'force-static';

const LoginLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <FullScreenSplitLayout>
      <div id="top-slot" className="absolute top-0 w-full sm:w-2/3" />
      <FullScreenSplitMain>{children}</FullScreenSplitMain>
    </FullScreenSplitLayout>
  );
};

export default LoginLayout;
