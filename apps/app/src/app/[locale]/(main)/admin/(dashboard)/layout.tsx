import { Suspense, type ReactNode } from 'react';

import {
  PlatformAdminHeader,
  PlatformStats,
  PlatformStatsSkeleton,
} from '@/components/screens/PlatformAdmin';

/** Dashboard pages share the platform-admin header and stats row. */
export default function AdminDashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      <PlatformAdminHeader />
      <Suspense fallback={<PlatformStatsSkeleton />}>
        <PlatformStats />
      </Suspense>
      {children}
    </>
  );
}
