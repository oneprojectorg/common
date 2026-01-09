import { FullScreenSplitAside } from '@/components/layout/split/FullScreenSplitAside';
import { FullScreenSplitLayout } from '@/components/layout/split/FullScreenSplitLayout';
import { FullScreenSplitMain } from '@/components/layout/split/FullScreenSplitMain';

const StartLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <FullScreenSplitLayout>
      <div id="top-slot" className="top-0 lg:w-2/3 absolute w-full" />
      <FullScreenSplitMain>{children}</FullScreenSplitMain>
      <FullScreenSplitAside />
    </FullScreenSplitLayout>
  );
};

export default StartLayout;
