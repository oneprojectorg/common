'use client';

import { createContext, use, useLayoutEffect, useRef } from 'react';
import type {
  ButtonProps,
  DisclosureGroupProps,
  DisclosurePanelProps,
  DisclosureProps,
  Key,
} from 'react-aria-components';
import {
  Button,
  DisclosureGroup as DisclosureGroupPrimitive,
  DisclosurePanel as DisclosurePanelPrimitive,
  Disclosure as DisclosurePrimitive,
  DisclosureStateContext,
} from 'react-aria-components';
import { LuChevronRight } from 'react-icons/lu';
import { tv } from 'tailwind-variants';

import { cx } from '../../lib/primitive';
import { cn } from '../../lib/utils';

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
    content:
      'h-[var(--disclosure-panel-height)] overflow-hidden transition-[height] duration-200 ease-out motion-reduce:transition-none',
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

interface AccordionItemProps extends Omit<DisclosureProps, 'className'> {
  /** Unique identifier for this item */
  id: Key;
  /** Controlled expansion state */
  isExpanded?: boolean;
  /** Default expansion state */
  defaultExpanded?: boolean;
  /** Callback when expansion changes */
  onExpandedChange?: (isExpanded: boolean) => void;
  /** Disable this item */
  isDisabled?: boolean;
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
    <DisclosurePrimitive {...props} className={cx(styles.item(), className)}>
      {children}
    </DisclosurePrimitive>
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
  extends Omit<ButtonProps, 'slot' | 'className' | 'children'> {
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
    <Button
      {...props}
      slot="trigger"
      className={cx(styles.trigger(), className)}
    >
      {showIndicator && indicatorPosition === 'start' && <AccordionIndicator />}
      {children}
      {showIndicator && indicatorPosition === 'end' && <AccordionIndicator />}
    </Button>
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
  extends Omit<DisclosurePanelProps, 'className'> {
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
  const state = use(DisclosureStateContext);
  const panelRef = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);

  // Manually set --disclosure-panel-height for animation
  // useLayoutEffect ensures measurements and DOM mutations happen before paint
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) {
      return;
    }

    if (isFirstRender.current) {
      // No animation on first render
      isFirstRender.current = false;
      if (state?.isExpanded) {
        panel.style.setProperty('--disclosure-panel-height', 'auto');
      } else {
        panel.style.setProperty('--disclosure-panel-height', '0px');
      }
      return;
    }

    if (state?.isExpanded) {
      // Expanding: ensure panel is measurable before reading scrollHeight.
      // React Aria's useDisclosure manages the hidden attribute via a useLayoutEffect
      // in the parent Disclosure component, which fires AFTER this child effect.
      // Without this, scrollHeight can return 0 when the browser's layout cache has
      // been invalidated (e.g. after a drag-and-drop reorder).
      panel.removeAttribute('hidden');
      const height = panel.scrollHeight;
      panel.style.setProperty('--disclosure-panel-height', `${height}px`);

      const onTransitionEnd = () => {
        panel.style.setProperty('--disclosure-panel-height', 'auto');
        panel.removeEventListener('transitionend', onTransitionEnd);
      };
      panel.addEventListener('transitionend', onTransitionEnd);
    } else {
      // Collapsing: set current height first, force reflow, then animate to 0
      const height = panel.scrollHeight;
      panel.style.setProperty('--disclosure-panel-height', `${height}px`);
      // Force reflow
      void panel.offsetHeight;
      panel.style.setProperty('--disclosure-panel-height', '0px');
    }
  }, [state?.isExpanded]);

  return (
    <DisclosurePanelPrimitive
      {...props}
      ref={panelRef}
      className={cx(styles.content(), className)}
    >
      <div className={cn(styles.contentInner())}>{children}</div>
    </DisclosurePanelPrimitive>
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
