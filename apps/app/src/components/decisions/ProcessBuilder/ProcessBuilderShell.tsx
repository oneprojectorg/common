'use client';

import { SidebarProvider } from '@op/sense/Sidebar';

export function ProcessBuilderShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SidebarProvider>{children}</SidebarProvider>;
}
