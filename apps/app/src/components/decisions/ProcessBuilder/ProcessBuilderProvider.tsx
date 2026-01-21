'use client';

import { SidebarProvider } from '@op/ui/Sidebar';

export const ProcessBuilderProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  return (
    <SidebarProvider isOpen className="flex h-full flex-col">
      {children}
    </SidebarProvider>
  );
};
