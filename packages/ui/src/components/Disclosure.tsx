'use client';

import { ChevronRight } from 'lucide-react';
import { useContext } from 'react';
import {
  Disclosure as AriaDisclosure,
  DisclosureGroup as AriaDisclosureGroup,
  DisclosurePanel as AriaDisclosurePanel,
  Button,
  composeRenderProps,
  DisclosureGroupStateContext,
  DisclosureStateContext,
  Heading,
} from 'react-aria-components';
import { tv } from 'tailwind-variants';

import { composeTailwindRenderProps, focusRing } from '../utils';

import type {
  DisclosureGroupProps as AriaDisclosureGroupProps,
  DisclosurePanelProps as AriaDisclosurePanelProps,
  DisclosureProps as AriaDisclosureProps,
} from 'react-aria-components';

const disclosure = tv({
  base: '-neutral-400 group min-w-64 rounded-lg border text-neutral-800',
  variants: {
    isInGroup: {
      true: 'rounded-b-none border-0 border-b last:rounded-b-lg last:border-b-0',
    },
  },
});

const disclosureButton = tv({
  extend: focusRing,
  base: 'flex w-full cursor-default items-center gap-2 rounded-lg p-2 text-start',
  variants: {
    isDisabled: {
      true: 'text-neutral-400',
    },
    isInGroup: {
      true: 'rounded-none -outline-offset-2 group-first:rounded-t-lg group-last:rounded-b-lg',
    },
  },
});

const chevron = tv({
  base: 'size-5 text-neutral-600 transition-transform duration-200 ease-in-out',
  variants: {
    isExpanded: {
      true: 'rotate-90 transform',
    },
    isDisabled: {
      true: 'text-neutral-400',
    },
  },
});

export interface DisclosureProps extends AriaDisclosureProps {
  children: React.ReactNode;
}

export const Disclosure = ({ children, ...props }: DisclosureProps) => {
  const isInGroup = useContext(DisclosureGroupStateContext) !== null;

  return (
    <AriaDisclosure
      {...props}
      className={composeRenderProps(props.className, (className, renderProps) =>
        disclosure({ ...renderProps, isInGroup, className }))}
    >
      {children}
    </AriaDisclosure>
  );
};

export interface DisclosureHeaderProps {
  children: React.ReactNode;
}

export const DisclosureHeader = ({ children }: DisclosureHeaderProps) => {
  const { isExpanded } = useContext(DisclosureStateContext)!;
  const isInGroup = useContext(DisclosureGroupStateContext) !== null;

  return (
    <Heading className="text-lg font-semibold">
      <Button
        slot="trigger"
        className={renderProps =>
          disclosureButton({ ...renderProps, isInGroup })}
      >
        {({ isDisabled }) => (
          <>
            <ChevronRight
              aria-hidden
              className={chevron({ isExpanded, isDisabled })}
            />
            {children}
          </>
        )}
      </Button>
    </Heading>
  );
};

export interface DisclosurePanelProps extends AriaDisclosurePanelProps {
  children: React.ReactNode;
}

export const DisclosurePanel = ({
  children,
  ...props
}: DisclosurePanelProps) => {
  return (
    <AriaDisclosurePanel
      {...props}
      className={composeTailwindRenderProps(
        props.className,
        'group-data-[expanded]:px-4 group-data-[expanded]:py-2',
      )}
    >
      {children}
    </AriaDisclosurePanel>
  );
};

export interface DisclosureGroupProps extends AriaDisclosureGroupProps {
  children: React.ReactNode;
}

export const DisclosureGroup = ({
  children,
  ...props
}: DisclosureGroupProps) => {
  return (
    <AriaDisclosureGroup
      {...props}
      className={composeTailwindRenderProps(
        props.className,
        '-neutral-400 rounded-lg border',
      )}
    >
      {children}
    </AriaDisclosureGroup>
  );
};
