'use client';

import {
  composeRenderProps,
  Tab as RACTab,
  TabList as RACTabList,
  TabPanel as RACTabPanel,
  Tabs as RACTabs,
} from 'react-aria-components';
import { tv } from 'tailwind-variants';

import { focusRing } from '../utils';

import type {
  TabListProps,
  TabPanelProps,
  TabProps,
  TabsProps,
} from 'react-aria-components';

const tabsStyles = tv({
  base: 'flex gap-4',
  variants: {
    orientation: {
      horizontal: 'flex-col',
      vertical: 'flex-row',
    },
  },
});

export const Tabs = (props: TabsProps) => {
  return (
    <RACTabs
      {...props}
      className={composeRenderProps(props.className, (className, renderProps) =>
        tabsStyles({ ...renderProps, className }))}
    />
  );
};

const tabListStyles = tv({
  base: 'flex gap-1',
  variants: {
    orientation: {
      horizontal: 'flex-row',
      vertical: 'flex-col items-start',
    },
  },
});

export const TabList = <T extends object>(props: TabListProps<T>) => {
  return (
    <RACTabList
      {...props}
      className={composeRenderProps(props.className, (className, renderProps) =>
        tabListStyles({ ...renderProps, className }))}
    />
  );
};

const tabProps = tv({
  extend: focusRing,
  base: 'flex cursor-default items-center rounded-full px-4 py-1.5 text-sm font-medium transition forced-color-adjust-none',
  variants: {
    isSelected: {
      false:
        'text-neutral-700 hover:bg-neutral-200 hover:text-neutral-800 pressed:bg-neutral-200 pressed:text-neutral-800',
      true: 'bg-neutral-800 text-black',
    },
    isDisabled: {
      true: 'text-neutral-400 selected:bg-neutral-400 selected:text-neutral-500',
    },
  },
});

export const Tab = (props: TabProps & { unstyled?: boolean }) => {
  return (
    <RACTab
      {...props}
      className={composeRenderProps(
        props.className,
        (className, renderProps) =>
          props.unstyled
            ? className || ''
            : tabProps({ ...renderProps, className }),
      )}
    />
  );
};

const tabPanelStyles = tv({
  extend: focusRing,
  base: 'flex-1 p-4 text-sm text-neutral-900',
});

export const TabPanel = (props: TabPanelProps) => {
  return (
    <RACTabPanel
      {...props}
      className={composeRenderProps(props.className, (className, renderProps) =>
        tabPanelStyles({ ...renderProps, className }))}
    />
  );
};
