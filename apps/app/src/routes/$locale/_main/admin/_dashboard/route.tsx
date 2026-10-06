import { Outlet, createFileRoute } from '@tanstack/react-router';

import {
  PlatformAdminHeader,
  PlatformStats,
} from '@/components/screens/PlatformAdmin';
import { AdminLoading } from '@/components/screens/PlatformAdmin/AdminLoading';

/** Dashboard pages share the platform-admin header and stats row. */
export const Route = createFileRoute('/$locale/_main/admin/_dashboard')({
  pendingComponent: AdminLoading,
  component: AdminDashboardLayout,
});

function AdminDashboardLayout() {
  return (
    <>
      <PlatformAdminHeader />
      <PlatformStats />
      <Outlet />
    </>
  );
}
