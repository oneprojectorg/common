import { Outlet, createFileRoute } from '@tanstack/react-router';

import { FullScreenSplitLayout } from '@/components/layout/split/FullScreenSplitLayout';
import { FullScreenSplitMain } from '@/components/layout/split/FullScreenSplitMain';

export const Route = createFileRoute('/info')({
  component: InfoLayout,
});

function InfoLayout() {
  return (
    <FullScreenSplitLayout>
      <div id="top-slot" className="absolute top-0 w-full sm:w-2/3" />
      <FullScreenSplitMain>
        <Outlet />
      </FullScreenSplitMain>
    </FullScreenSplitLayout>
  );
}
