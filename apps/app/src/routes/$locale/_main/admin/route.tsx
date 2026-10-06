import { assertPlatformAdmin } from '@/server/layouts.functions';
import { Outlet, createFileRoute } from '@tanstack/react-router';
import type { ReactNode } from 'react';

import { AdminLoading } from '@/components/screens/PlatformAdmin/AdminLoading';

export const Route = createFileRoute('/$locale/_main/admin')({
  loader: () => assertPlatformAdmin(),
  // Admin access is checked when the area is entered, like a persistent
  // layout; `router.invalidate()` re-runs it.
  staleTime: Infinity,
  pendingComponent: () => (
    <AdminFrame>
      <AdminLoading />
    </AdminFrame>
  ),
  component: () => (
    <AdminFrame>
      <Outlet />
    </AdminFrame>
  ),
});

function AdminFrame({ children }: { children: ReactNode }) {
  return <div className="flex w-full flex-col gap-8 p-8">{children}</div>;
}
