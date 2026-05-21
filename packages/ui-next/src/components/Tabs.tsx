// Compat wrapper for @op/ui's Tabs. Pure API translation onto vanilla shadcn
// Tabs primitives (no style overrides).
//
// API map:
//   selectedKey/onSelectionChange -> value/onValueChange
//   id (on Tab/TabPanel)          -> value
//   variant=pill                  -> shadcn TabsList variant=default
//   variant=default               -> shadcn TabsList variant=line
//
// Variant is only meaningful on TabList; the per-Tab variant prop in the legacy
// API is accepted for source-compat and ignored.

'use client';

import * as React from 'react';

import {
  Tabs as ShadcnTabs,
  TabsList as ShadcnTabsList,
  TabsTrigger as ShadcnTabsTrigger,
  TabsContent as ShadcnTabsContent,
} from './ui/tabs';

type Orientation = 'horizontal' | 'vertical';
type LegacyVariant = 'default' | 'pill';

export interface TabsProps {
  children: React.ReactNode;
  className?: string;
  selectedKey?: string | number;
  defaultSelectedKey?: string | number;
  onSelectionChange?: (key: string | number) => void;
  orientation?: Orientation;
  'aria-label'?: string;
}

export const Tabs = ({
  children,
  className,
  selectedKey,
  defaultSelectedKey,
  onSelectionChange,
  orientation = 'horizontal',
  'aria-label': ariaLabel,
}: TabsProps) => {
  return (
    <ShadcnTabs
      value={selectedKey != null ? String(selectedKey) : undefined}
      defaultValue={
        defaultSelectedKey != null ? String(defaultSelectedKey) : undefined
      }
      onValueChange={onSelectionChange}
      orientation={orientation}
      aria-label={ariaLabel}
      className={className}
    >
      {children}
    </ShadcnTabs>
  );
};

export interface TabListProps {
  children: React.ReactNode;
  className?: string;
  variant?: LegacyVariant;
  orientation?: Orientation;
  'aria-label'?: string;
}

export const TabList = ({
  children,
  className,
  variant = 'default',
  'aria-label': ariaLabel,
}: TabListProps) => {
  return (
    <ShadcnTabsList
      aria-label={ariaLabel}
      variant={variant === 'pill' ? 'default' : 'line'}
      className={className}
    >
      {children}
    </ShadcnTabsList>
  );
};

export interface TabProps {
  id: string;
  children: React.ReactNode;
  className?: string;
  variant?: LegacyVariant;
  isDisabled?: boolean;
  unstyled?: boolean;
}

export const Tab = ({ id, children, className, isDisabled }: TabProps) => {
  return (
    <ShadcnTabsTrigger value={id} disabled={isDisabled} className={className}>
      {children}
    </ShadcnTabsTrigger>
  );
};

export interface TabPanelProps {
  id: string;
  children: React.ReactNode;
  className?: string;
}

export const TabPanel = ({ id, children, className }: TabPanelProps) => {
  return (
    <ShadcnTabsContent value={id} className={className}>
      {children}
    </ShadcnTabsContent>
  );
};
