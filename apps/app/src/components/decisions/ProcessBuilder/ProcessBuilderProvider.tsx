'use client';

import { SidebarProvider } from '@op/ui/Sidebar';
import { createContext, useContext } from 'react';

import {
  DEFAULT_VISIBILITY_CONFIG,
  type VisibilityConfig,
} from './navigation-config';

interface ProcessBuilderContextValue {
  visibilityConfig: VisibilityConfig;
}

const ProcessBuilderContext = createContext<ProcessBuilderContextValue>({
  visibilityConfig: DEFAULT_VISIBILITY_CONFIG,
});

export const useProcessBuilderContext = () => useContext(ProcessBuilderContext);

export const ProcessBuilderProvider = ({
  children,
  visibilityConfig = DEFAULT_VISIBILITY_CONFIG,
}: {
  children: React.ReactNode;
  visibilityConfig?: VisibilityConfig;
}) => {
  return (
    <ProcessBuilderContext.Provider value={{ visibilityConfig }}>
      <SidebarProvider isOpen className="flex h-full flex-col">
        {children}
      </SidebarProvider>
    </ProcessBuilderContext.Provider>
  );
};
