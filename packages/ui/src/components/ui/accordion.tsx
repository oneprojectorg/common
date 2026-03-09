'use client';

import { createContext, use } from 'react';
import type { DisclosureGroupProps, Key } from 'react-aria-components';
import { DisclosureGroup as DisclosureGroupPrimitive } from 'react-aria-components';
import { LuChevronRight } from 'react-icons/lu';
import { tv } from 'tailwind-variants';

import { cx } from '../../lib/primitive';
import { cn } from '../../lib/utils';
import type {
  CollapsibleContentProps,
  CollapsibleProps,
  CollapsibleTriggerProps,
} from './collapsible';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from './collapsible';

// ============================================================================
// Styles
// ============================================================================

const accordionStyles = tv({
  slots: {
    root: '',
    item: 'group/accordion-item',
    header: '',
    trigger: '',
    indicator:
      'size-4 shrink-0 transition-transform duration-200 group-data-[expanded]/accordion-item:rotate-90',
    content: '',
    contentInner: '',
  },
  variants: {
    variant: {
      default: {
        root: 'flex flex-col gap-3',
        item: 'rounded-lg border bg-white',
        header: 'flex items-center px-4 py-2',
        trigger: [
          'flex flex-1 items-center gap-3',
          'cursor-pointer text-left font-medium',
          'outline-none',
          'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
          'disabled:cursor-not-allowed disabled:opacity-50',
        ],
        indicator: 'text-muted-fg',
        content: '',
        contentInner: 'p-4',
      },
      unstyled: {},
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

type AccordionStyles = ReturnType<typeof accordionStyles>;

// ============================================================================
// Context
// ============================================================================

const AccordionContext = createContext<AccordionStyles>(
  accordionStyles({ variant: 'default' }),
);

const useAccordionStyles = () => use(AccordionContext);

// ============================================================================
// Accordion (Group)
// ============================================================================

interface AccordionProps extends Omit<DisclosureGroupProps, 'className'> {
  /** Whether multiple items can be expanded simultaneously. Default: false */
  allowsMultipleExpanded?: boolean;
  /** Currently expanded keys (controlled) */
  expandedKeys?: Iterable<Key>;
  /** Default expanded keys (uncontrolled) */
  defaultExpandedKeys?: Iterable<Key>;
  /** Callback when expansion state changes */
  onExpandedChange?: (keys: Set<Key>) => void;
  /** Disable all child disclosures */
  isDisabled?: boolean;
  /** Visual style variant */
  variant?: 'default' | 'unstyled';
  /** Custom className */
  className?: string;
  children: React.ReactNode;
}

const Accordion = ({
  variant = 'default',
  className,
  children,
  ...props
}: AccordionProps) => {
  const styles = accordionStyles({ variant });

  return (
    <AccordionContext.Provider value={styles}>
      <DisclosureGroupPrimitive
        {...props}
        className={cx(styles.root(), className)}
      >
        {children}
      </DisclosureGroupPrimitive>
    </AccordionContext.Provider>
  );
};

// ============================================================================
// AccordionItem
// ============================================================================

interface AccordionItemProps extends Omit<CollapsibleProps, 'className'> {
  /** Unique identifier for this item */
  id: Key;
  /** Custom className (supports render props) */
  className?:
    | string
    | ((state: { isExpanded: boolean; isDisabled: boolean }) => string);
  children: React.ReactNode;
}

const AccordionItem = ({
  className,
  children,
  ...props
}: AccordionItemProps) => {
  const styles = useAccordionStyles();

  return (
    <Collapsible {...props} className={cx(styles.item(), className)}>
      {children}
    </Collapsible>
  );
};

// ============================================================================
// AccordionHeader
// ============================================================================

interface AccordionHeaderProps {
  /** Custom className */
  className?: string;
  children: React.ReactNode;
}

const AccordionHeader = ({ className, children }: AccordionHeaderProps) => {
  const styles = useAccordionStyles();

  return <div className={cn(styles.header(), className)}>{children}</div>;
};

// ============================================================================
// AccordionTrigger
// ============================================================================

interface AccordionTriggerProps
  extends Omit<CollapsibleTriggerProps, 'className' | 'children'> {
  /** Auto-include indicator. Default: false */
  showIndicator?: boolean;
  /** Indicator position if showIndicator is true. Default: 'start' */
  indicatorPosition?: 'start' | 'end';
  /** Custom className (supports render props) */
  className?: string;
  children: React.ReactNode;
}

const AccordionTrigger = ({
  showIndicator = false,
  indicatorPosition = 'start',
  className,
  children,
  ...props
}: AccordionTriggerProps) => {
  const styles = useAccordionStyles();

  return (
    <CollapsibleTrigger {...props} className={cx(styles.trigger(), className)}>
      {showIndicator && indicatorPosition === 'start' && <AccordionIndicator />}
      {children}
      {showIndicator && indicatorPosition === 'end' && <AccordionIndicator />}
    </CollapsibleTrigger>
  );
};

// ============================================================================
// AccordionIndicator
// ============================================================================

interface AccordionIndicatorProps {
  /** Custom icon component */
  icon?: React.ComponentType<{ className?: string }>;
  /** Custom className */
  className?: string;
}

const AccordionIndicator = ({
  icon: Icon = LuChevronRight,
  className,
}: AccordionIndicatorProps) => {
  const styles = useAccordionStyles();

  return <Icon aria-hidden className={cn(styles.indicator(), className)} />;
};

// ============================================================================
// AccordionContent
// ============================================================================

interface AccordionContentProps
  extends Omit<CollapsibleContentProps, 'className'> {
  /** Custom className */
  className?: string;
  children: React.ReactNode;
}

const AccordionContent = ({
  className,
  children,
  ...props
}: AccordionContentProps) => {
  const styles = useAccordionStyles();

  return (
    <CollapsibleContent {...props} className={cn(styles.content(), className)}>
      <div className={cn(styles.contentInner())}>{children}</div>
    </CollapsibleContent>
  );
};

// ============================================================================
// Exports
// ============================================================================

export type {
  AccordionProps,
  AccordionItemProps,
  AccordionHeaderProps,
  AccordionTriggerProps,
  AccordionIndicatorProps,
  AccordionContentProps,
};

export {
  Accordion,
  AccordionItem,
  AccordionHeader,
  AccordionTrigger,
  AccordionIndicator,
  AccordionContent,
};
