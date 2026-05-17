'use client';

import { SidebarProvider } from '@op/ui-next/Sidebar';

export function ProcessBuilderShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SidebarProvider>{children}</SidebarProvider>;
}
