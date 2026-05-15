// Compat wrapper for @op/ui's Tabs. Maps legacy RAC API
// (selectedKey/onSelectionChange/id/variant=pill) onto shadcn base-ui Tabs.

'use client';

import * as React from 'react';

import {
  Tabs as ShadcnTabs,
  TabsList as ShadcnTabsList,
  TabsTrigger as ShadcnTabsTrigger,
  TabsContent as ShadcnTabsContent,
} from './ui/tabs';
import { cn } from '../lib/utils';

type Orientation = 'horizontal' | 'vertical';
type TabVariant = 'default' | 'pill';

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
      className={cn('flex gap-4', className)}
    >
      {children}
    </ShadcnTabs>
  );
};

export interface TabListProps {
  children: React.ReactNode;
  className?: string;
  variant?: TabVariant;
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
      className={cn(
        'h-auto w-fit gap-4 overflow-x-auto rounded-none bg-transparent p-0',
        variant === 'default' &&
          'border-b border-offWhite group-data-vertical/tabs:flex-col group-data-vertical/tabs:border-b-0',
        variant === 'pill' && 'gap-2 rounded-lg border-none bg-transparent p-1',
        className,
      )}
    >
      {children}
    </ShadcnTabsList>
  );
};

export interface TabProps {
  id: string;
  children: React.ReactNode;
  className?: string;
  variant?: TabVariant;
  isDisabled?: boolean;
  unstyled?: boolean;
}

export const Tab = ({
  id,
  children,
  className,
  variant = 'default',
  isDisabled,
  unstyled,
}: TabProps) => {
  if (unstyled) {
    return (
      <ShadcnTabsTrigger
        value={id}
        disabled={isDisabled}
        className={className}
      >
        {children}
      </ShadcnTabsTrigger>
    );
  }
  return (
    <ShadcnTabsTrigger
      value={id}
      disabled={isDisabled}
      className={cn(
        'flex h-8 cursor-default items-center px-2 py-3 text-base font-normal whitespace-nowrap text-neutral-gray4 outline-none transition focus-visible:bg-neutral-offWhite sm:h-auto sm:bg-transparent',
        variant === 'default' &&
          'rounded-none border-b border-transparent data-active:border-charcoal data-active:text-charcoal data-active:shadow-none data-active:bg-transparent',
        variant === 'pill' &&
          'rounded-md border-none bg-neutral-offWhite p-3 sm:py-2 data-active:bg-neutral-gray1 data-active:text-neutral-charcoal data-active:shadow-none',
        isDisabled && 'text-lightGray',
        className,
      )}
    >
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
    <ShadcnTabsContent
      value={id}
      className={cn('flex-1 text-base sm:p-4', className)}
    >
      {children}
    </ShadcnTabsContent>
  );
};
