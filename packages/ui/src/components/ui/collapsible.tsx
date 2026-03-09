'use client';

import { use, useLayoutEffect, useRef } from 'react';
import type {
  ButtonProps,
  DisclosurePanelProps,
  DisclosureProps,
} from 'react-aria-components';
import {
  Button,
  DisclosurePanel as DisclosurePanelPrimitive,
  Disclosure as DisclosurePrimitive,
  DisclosureStateContext,
} from 'react-aria-components';

import { cx } from '../../lib/primitive';
import { cn } from '../../lib/utils';

// ============================================================================
// Collapsible
// ============================================================================

interface CollapsibleProps extends Omit<DisclosureProps, 'className'> {
  /** Controlled expansion state */
  isExpanded?: boolean;
  /** Default expansion state (uncontrolled) */
  defaultExpanded?: boolean;
  /** Callback when expansion changes */
  onExpandedChange?: (isExpanded: boolean) => void;
  /** Disable this collapsible */
  isDisabled?: boolean;
  /** Custom className (supports render props) */
  className?:
    | string
    | ((state: { isExpanded: boolean; isDisabled: boolean }) => string);
  children: React.ReactNode;
}

const Collapsible = ({ className, children, ...props }: CollapsibleProps) => {
  return (
    <DisclosurePrimitive {...props} className={cx(className)}>
      {children}
    </DisclosurePrimitive>
  );
};

// ============================================================================
// CollapsibleTrigger
// ============================================================================

interface CollapsibleTriggerProps extends Omit<ButtonProps, 'slot'> {}

const CollapsibleTrigger = ({
  className,
  children,
  ...props
}: CollapsibleTriggerProps) => {
  return (
    <Button {...props} slot="trigger" className={cx(className)}>
      {children}
    </Button>
  );
};

// ============================================================================
// CollapsibleContent
// ============================================================================

interface CollapsibleContentProps
  extends Omit<DisclosurePanelProps, 'className'> {
  /** Custom className */
  className?: string;
  children: React.ReactNode;
}

const CONTENT_STYLES =
  'h-[var(--disclosure-panel-height)] overflow-hidden transition-[height] duration-200 ease-out motion-reduce:transition-none [&[hidden]]:![content-visibility:visible]';

const CollapsibleContent = ({
  className,
  children,
  ...props
}: CollapsibleContentProps) => {
  const state = use(DisclosureStateContext);
  const panelRef = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) {
      return;
    }

    if (isFirstRender.current) {
      isFirstRender.current = false;
      if (state?.isExpanded) {
        panel.style.setProperty('--disclosure-panel-height', 'auto');
      } else {
        panel.style.setProperty('--disclosure-panel-height', '0px');
      }
      return;
    }

    if (state?.isExpanded) {
      if (
        panel.style.getPropertyValue('--disclosure-panel-height') === 'auto'
      ) {
        return;
      }

      panel.removeAttribute('hidden');
      const height = panel.scrollHeight;
      panel.style.setProperty('--disclosure-panel-height', `${height}px`);

      const onTransitionEnd = () => {
        panel.style.setProperty('--disclosure-panel-height', 'auto');
        panel.removeEventListener('transitionend', onTransitionEnd);
      };
      panel.addEventListener('transitionend', onTransitionEnd);
    } else {
      const height = panel.scrollHeight;
      panel.style.setProperty('--disclosure-panel-height', `${height}px`);
      void panel.offsetHeight;
      panel.style.setProperty('--disclosure-panel-height', '0px');
    }
  }, [state?.isExpanded]);

  return (
    <DisclosurePanelPrimitive
      {...props}
      ref={panelRef}
      className={cn(CONTENT_STYLES, className)}
    >
      {children}
    </DisclosurePanelPrimitive>
  );
};

// ============================================================================
// Exports
// ============================================================================

export type {
  CollapsibleProps,
  CollapsibleTriggerProps,
  CollapsibleContentProps,
};

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
