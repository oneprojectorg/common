'use client';

import { SidebarProvider } from '@op/ui/Sidebar';
import { createContext, useContext } from 'react';

import {
  DEFAULT_NAVIGATION_CONFIG,
  type NavigationConfig,
} from './navigation-config';

interface ProcessBuilderContextValue {
  navigationConfig: NavigationConfig;
}

const ProcessBuilderContext = createContext<ProcessBuilderContextValue>({
  navigationConfig: DEFAULT_NAVIGATION_CONFIG,
});

export const useProcessBuilderContext = () => useContext(ProcessBuilderContext);

export const ProcessBuilderProvider = ({
  children,
  navigationConfig = DEFAULT_NAVIGATION_CONFIG,
}: {
  children: React.ReactNode;
  navigationConfig?: NavigationConfig;
}) => {
  return (
    <ProcessBuilderContext.Provider value={{ navigationConfig }}>
      <SidebarProvider isOpen className="flex h-full flex-col">
        {children}
      </SidebarProvider>
    </ProcessBuilderContext.Provider>
  );
};
