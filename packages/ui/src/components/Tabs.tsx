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
  base: 'gap-4 flex',
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
  base: 'gap-4 flex overflow-x-auto',
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
  base: 'h-8 px-2 py-3 font-normal sm:h-auto sm:bg-transparent flex cursor-default items-center text-base text-nowrap text-neutral-gray4 outline-hidden transition forced-color-adjust-none focus-visible:bg-neutral-offWhite',
  variants: {
    variant: {
      default: '',
      pill: 'border-b-none p-3 sm:py-2 rounded-sm bg-neutral-offWhite',
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
        'sm:bg-neutral-gray1 border-none bg-neutral-gray1 text-neutral-charcoal',
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
  base: 'sm:p-4 flex-1 text-base',
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
