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
      vertical: '',
    },
  },
});

export const Tabs = (props: TabsProps) => {
  return (
    <RACTabs
      {...props}
      className={composeRenderProps(props.className, (className, renderProps) =>
        tabsStyles({ ...renderProps, className }),
      )}
    />
  );
};

const tabListStyles = tv({
  base: 'flex gap-6',
  variants: {
    orientation: {
      horizontal: 'flex-row border-b border-offWhite',
      vertical: '',
    },
  },
});

export const TabList = <T extends object>(props: TabListProps<T>) => {
  return (
    <RACTabList
      {...props}
      className={composeRenderProps(props.className, (className, renderProps) =>
        tabListStyles({ ...renderProps, className }),
      )}
    />
  );
};

const tabProps = tv({
  extend: focusRing,
  base: 'flex cursor-default items-center p-3 text-sm font-medium text-darkGray transition forced-color-adjust-none',
  variants: {
    isSelected: {
      false: '',
      true: 'border-b border-charcoal text-charcoal',
    },
    isDisabled: {
      true: 'text-lightGray',
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
  base: 'flex-1 p-4 text-base',
});

export const TabPanel = (props: TabPanelProps) => {
  return (
    <RACTabPanel
      {...props}
      className={composeRenderProps(props.className, (className, renderProps) =>
        tabPanelStyles({ ...renderProps, className }),
      )}
    />
  );
};
