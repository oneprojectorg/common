'use client';

import {
  Tab as RACTab,
  TabList as RACTabList,
  TabPanel as RACTabPanel,
  Tabs as RACTabs,
  composeRenderProps,
} from 'react-aria-components';
import type {
  TabListProps,
  TabPanelProps,
  TabProps,
  TabsProps,
} from 'react-aria-components';
import { VariantProps, tv } from 'tailwind-variants';

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
  base: 'flex gap-4 overflow-x-auto',
  variants: {
    variant: {
      default: '',
      pill: 'border-none',
    },
    orientation: {
      horizontal: 'flex-row border-b border-offWhite',
      vertical: '',
    },
  },
  defaultVariants: {
    variant: 'default',
    orientation: 'horizontal',
  },
});
export type TabListVariantsProps = VariantProps<typeof tabListStyles>;

export const TabList = <T extends object>(
  props: TabListProps<T> & TabListVariantsProps,
) => {
  return (
    <RACTabList
      {...props}
      className={composeRenderProps(props.className, (className, renderProps) =>
        tabListStyles({ ...renderProps, variant: props.variant, className }),
      )}
    />
  );
};

const tabProps = tv({
  base: 'flex h-8 cursor-default items-center px-2 py-3 text-base font-normal text-nowrap text-neutral-gray4 outline-hidden transition forced-color-adjust-none focus-visible:bg-neutral-offWhite sm:h-auto sm:bg-transparent',
  variants: {
    variant: {
      default: '',
      pill: 'border-b-none rounded-sm bg-neutral-offWhite p-3 sm:py-2',
    },
    isSelected: {
      false: '',
      true: 'border-b border-charcoal text-charcoal',
    },
    isDisabled: {
      true: 'text-lightGray',
    },
  },
  compoundVariants: [
    {
      variant: 'pill',
      isSelected: true,
      class:
        'border-none bg-neutral-gray1 text-neutral-charcoal sm:bg-neutral-gray1',
    },
  ],
  defaultVariants: {
    variant: 'default',
  },
});
export type TabVariantsProps = VariantProps<typeof tabProps>;

export const Tab = (
  props: TabProps & TabVariantsProps & { unstyled?: boolean },
) => {
  return (
    <RACTab
      {...props}
      className={composeRenderProps(
        props.className,
        (className, renderProps) =>
          props.unstyled
            ? className || ''
            : tabProps({ ...renderProps, variant: props.variant, className }),
      )}
    />
  );
};

const tabPanelStyles = tv({
  base: 'flex-1 text-base sm:p-4',
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
