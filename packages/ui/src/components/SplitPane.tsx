'use client';

import {
  Children,
  type ReactElement,
  type ReactNode,
  isValidElement,
  useState,
} from 'react';

import { cn } from '../lib/utils';

export interface SplitPaneProps {
  children: ReactNode;
  /** Id of the pane shown by default on mobile. Defaults to the first pane. */
  defaultMobileTab?: string;
  className?: string;
  mobileTabListClassName?: string;
}

export interface SplitPanePaneProps {
  id: string;
  label: string;
  className?: string;
  children: ReactNode;
}

// Marker subcomponent — SplitPane reads its props. Never renders on its own.
function Pane(_props: SplitPanePaneProps): null {
  return null;
}

// Each pane mounts once — visibility on mobile is toggled via CSS so stateful
// children (collaborative editors, forms) don't get double-mounted.
const paneBase =
  'flex min-w-0 flex-1 flex-col overflow-y-auto px-6 pt-8 pb-4 [scrollbar-gutter:stable] sm:basis-1/2 sm:p-12';

function SplitPaneImpl({
  children,
  defaultMobileTab,
  className,
  mobileTabListClassName,
}: SplitPaneProps) {
  const panes = Children.toArray(children).filter(
    (child): child is ReactElement<SplitPanePaneProps> =>
      isValidElement(child) && child.type === Pane,
  );

  const firstPaneId = panes[0]?.props.id ?? '';
  const [activeId, setActiveId] = useState<string>(
    defaultMobileTab ?? firstPaneId,
  );

  if (panes.length !== 2) {
    return null;
  }

  const [left, right] = panes as [
    ReactElement<SplitPanePaneProps>,
    ReactElement<SplitPanePaneProps>,
  ];

  return (
    <div className={cn('flex min-h-0 w-full flex-1 flex-col', className)}>
      <div
        role="tablist"
        aria-orientation="horizontal"
        className={cn(
          'mx-6 flex gap-4 border-b border-neutral-offWhite sm:hidden',
          mobileTabListClassName,
        )}
      >
        {panes.map((pane) => (
          <SplitPaneTabButton
            key={pane.props.id}
            isSelected={activeId === pane.props.id}
            onPress={() => setActiveId(pane.props.id)}
          >
            {pane.props.label}
          </SplitPaneTabButton>
        ))}
      </div>

      <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
        <div
          role="tabpanel"
          className={cn(
            paneBase,
            'sm:border-r sm:border-neutral-gray1',
            activeId === left.props.id ? 'flex' : 'hidden sm:flex',
            left.props.className,
          )}
        >
          {left.props.children}
        </div>
        <div
          role="tabpanel"
          className={cn(
            paneBase,
            activeId === right.props.id ? 'flex' : 'hidden sm:flex',
            right.props.className,
          )}
        >
          {right.props.children}
        </div>
      </div>
    </div>
  );
}

export const SplitPane = Object.assign(SplitPaneImpl, { Pane });

function SplitPaneTabButton({
  isSelected,
  onPress,
  children,
}: {
  isSelected: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isSelected}
      onClick={onPress}
      className={cn(
        'flex h-8 cursor-pointer items-center px-2 py-3 text-base font-normal outline-hidden transition focus-visible:bg-neutral-offWhite',
        isSelected
          ? 'border-b border-charcoal text-charcoal'
          : 'border-b border-transparent text-neutral-gray4',
      )}
    >
      {children}
    </button>
  );
}
