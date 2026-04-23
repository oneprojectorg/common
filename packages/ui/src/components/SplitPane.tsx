'use client';

import {
  Children,
  type ReactElement,
  type ReactNode,
  isValidElement,
  useState,
} from 'react';
import type { Key } from 'react-aria-components';

import { cn, tv } from '../lib/utils';
import { Tab, TabList, Tabs } from './Tabs';

export interface SplitPaneProps {
  children: ReactNode;
  /** Id of the pane shown by default on mobile. Defaults to the first pane. */
  defaultMobileTabId?: string;
  className?: string;
}

export interface SplitPanePaneProps {
  id: string;
  label: ReactNode;
  className?: string;
  /** Strip the pane's default padding (e.g. when the child handles its own). */
  unpadded?: boolean;
  children: ReactNode;
}

function Pane(_props: SplitPanePaneProps): null {
  return null;
}

// Each pane mounts once — visibility on mobile is toggled via CSS so stateful
// children (collaborative editors, forms) don't get double-mounted.
const paneStyles = tv({
  base: 'flex min-w-0 flex-1 flex-col overflow-y-auto [scrollbar-gutter:stable] sm:basis-1/2',
  variants: {
    padding: {
      default: 'px-6 pt-8 pb-4 sm:p-12',
      none: '',
    },
    position: {
      left: 'sm:border-r sm:border-neutral-gray1',
      right: '',
    },
    active: {
      true: 'flex',
      false: 'hidden sm:flex',
    },
  },
});

function SplitPaneImpl({
  children,
  defaultMobileTabId,
  className,
}: SplitPaneProps) {
  const panes = Children.toArray(children).filter(
    (child): child is ReactElement<SplitPanePaneProps> =>
      isValidElement(child) && child.type === Pane,
  );

  const [activeId, setActiveId] = useState<string>(
    defaultMobileTabId ?? panes[0]?.props.id ?? '',
  );

  if (panes.length !== 2) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        `SplitPane expects exactly 2 SplitPane.Pane children, received ${panes.length}.`,
      );
    }
    return null;
  }

  const [left, right] = panes as [
    ReactElement<SplitPanePaneProps>,
    ReactElement<SplitPanePaneProps>,
  ];

  const handleSelectionChange = (key: Key) => setActiveId(String(key));

  return (
    <div className={cn('flex min-h-0 w-full flex-1 flex-col', className)}>
      <Tabs
        className="gap-0 sm:hidden"
        selectedKey={activeId}
        onSelectionChange={handleSelectionChange}
      >
        <TabList className="mx-6" variant="default">
          <Tab id={left.props.id}>{left.props.label}</Tab>
          <Tab id={right.props.id}>{right.props.label}</Tab>
        </TabList>
      </Tabs>

      <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
        <div
          role="tabpanel"
          className={paneStyles({
            position: 'left',
            padding: left.props.unpadded ? 'none' : 'default',
            active: activeId === left.props.id,
            className: left.props.className,
          })}
        >
          {left.props.children}
        </div>
        <div
          role="tabpanel"
          className={paneStyles({
            position: 'right',
            padding: right.props.unpadded ? 'none' : 'default',
            active: activeId === right.props.id,
            className: right.props.className,
          })}
        >
          {right.props.children}
        </div>
      </div>
    </div>
  );
}

export const SplitPane = Object.assign(SplitPaneImpl, { Pane });
