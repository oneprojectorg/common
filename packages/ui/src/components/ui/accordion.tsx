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
  Heading,
} from 'react-aria-components';
import { LuChevronRight } from 'react-icons/lu';

import { cx } from '../../lib/primitive';
import { cn } from '../../lib/utils';

// cx() is used for RAC components that support render prop classNames (Button, Disclosure, etc.)
// cn() is used for elements that only accept string classNames (Heading, plain divs, icons)

// ============================================================================
// Context
// ============================================================================

interface AccordionContextValue {
  unstyled?: boolean;
}

const AccordionContext = createContext<AccordionContextValue>({});

const useAccordionContext = () => use(AccordionContext);

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
  /** Remove all default styling */
  unstyled?: boolean;
  /** Custom className */
  className?: string;
  children: React.ReactNode;
}

const Accordion = ({
  unstyled,
  className,
  children,
  ...props
}: AccordionProps) => {
  return (
    <AccordionContext.Provider value={{ unstyled }}>
      <DisclosureGroupPrimitive
        {...props}
        className={cx(!unstyled && 'flex flex-col', className)}
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
  /** Remove all default styling */
  unstyled?: boolean;
  /** Custom className (supports render props) */
  className?:
    | string
    | ((state: { isExpanded: boolean; isDisabled: boolean }) => string);
  children: React.ReactNode;
}

const AccordionItem = ({
  unstyled: unstyledProp,
  className,
  children,
  ...props
}: AccordionItemProps) => {
  const { unstyled: contextUnstyled } = useAccordionContext();
  const unstyled = unstyledProp ?? contextUnstyled;

  return (
    <DisclosurePrimitive
      {...props}
      className={cx(
        !unstyled && [
          'group/accordion-item',
          'border-b border-border',
          'data-[expanded]:bg-muted/30',
        ],
        className,
      )}
    >
      {children}
    </DisclosurePrimitive>
  );
};

// ============================================================================
// AccordionHeader
// ============================================================================

interface AccordionHeaderProps {
  /** Heading level for accessibility. Default: 3 */
  level?: 2 | 3 | 4 | 5 | 6;
  /** Remove all default styling */
  unstyled?: boolean;
  /** Custom className */
  className?: string;
  children: React.ReactNode;
}

const AccordionHeader = ({
  level = 3,
  unstyled: unstyledProp,
  className,
  children,
}: AccordionHeaderProps) => {
  const { unstyled: contextUnstyled } = useAccordionContext();
  const unstyled = unstyledProp ?? contextUnstyled;

  return (
    <Heading
      level={level}
      className={cn(!unstyled && ['flex items-center', 'px-4 py-3'], className)}
    >
      {children}
    </Heading>
  );
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
  /** Remove all default styling */
  unstyled?: boolean;
  /** Custom className (supports render props) */
  className?: string;
  children: React.ReactNode;
}

const AccordionTrigger = ({
  showIndicator = false,
  indicatorPosition = 'start',
  unstyled: unstyledProp,
  className,
  children,
  ...props
}: AccordionTriggerProps) => {
  const { unstyled: contextUnstyled } = useAccordionContext();
  const unstyled = unstyledProp ?? contextUnstyled;

  return (
    <Button
      {...props}
      slot="trigger"
      className={cx(
        !unstyled && [
          'flex flex-1 items-center gap-2',
          'cursor-pointer text-left font-medium',
          'outline-none',
          'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
          'disabled:cursor-not-allowed disabled:opacity-50',
        ],
        className,
      )}
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
  /** Custom className */
  className?: string;
}

const AccordionIndicator = ({ className }: AccordionIndicatorProps) => {
  const state = use(DisclosureStateContext);

  return (
    <LuChevronRight
      aria-hidden
      className={cn(
        'size-4 shrink-0 text-muted-fg transition-transform duration-200',
        state?.isExpanded && 'rotate-90',
        className,
      )}
    />
  );
};

// ============================================================================
// AccordionContent
// ============================================================================

interface AccordionContentProps
  extends Omit<DisclosurePanelProps, 'className'> {
  /** Remove all default styling */
  unstyled?: boolean;
  /** Custom className */
  className?: string;
  children: React.ReactNode;
}

const AccordionContent = ({
  unstyled: unstyledProp,
  className,
  children,
  ...props
}: AccordionContentProps) => {
  const { unstyled: contextUnstyled } = useAccordionContext();
  const unstyled = unstyledProp ?? contextUnstyled;
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
      // Expanding: measure and set height, then switch to auto after animation
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
      className={cx(
        // Animation styles always applied
        'h-[var(--disclosure-panel-height)] overflow-hidden',
        'transition-[height] duration-200 ease-out',
        'motion-reduce:transition-none',
        className,
      )}
    >
      <div className={cn(!unstyled && 'px-4 pb-4')}>{children}</div>
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
