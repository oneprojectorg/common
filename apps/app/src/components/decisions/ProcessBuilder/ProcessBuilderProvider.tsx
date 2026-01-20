'use client';

import { SidebarProvider } from '@op/ui/Sidebar';
import { useQueryState } from 'nuqs';

export const ProcessBuilderProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [selectedProcess] = useQueryState('process');
  return (
    <SidebarProvider
      isOpen={Boolean(selectedProcess)}
      className="flex h-full flex-col"
    >
      {children}
    </SidebarProvider>
  );
};
