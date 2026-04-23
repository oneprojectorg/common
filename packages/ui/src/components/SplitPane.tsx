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
  /** One or more `SplitPane.Pane` children. */
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
  base: 'flex min-w-0 flex-1 flex-col overflow-y-auto [scrollbar-gutter:stable]',
  variants: {
    padding: {
      default: 'px-6 pt-8 pb-4 sm:p-12',
      none: '',
    },
    divider: {
      true: 'sm:border-r sm:border-neutral-gray1',
      false: '',
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
    (child): child is ReactElement<SplitPanePaneProps> => isValidElement(child),
  );

  const [activeId, setActiveId] = useState<string>(
    defaultMobileTabId ?? panes[0]?.props.id ?? '',
  );

  if (process.env.NODE_ENV !== 'production') {
    if (panes.length < 1) {
      throw new Error('SplitPane expects at least 1 child.');
    }
    for (const pane of panes) {
      if (!pane.props.id || !pane.props.label) {
        throw new Error(
          'SplitPane children must have `id` and `label` props (use SplitPane.Pane).',
        );
      }
    }
  }

  if (panes.length < 1) {
    return null;
  }

  const handleSelectionChange = (key: Key) => setActiveId(String(key));
  const showTabs = panes.length > 1;

  return (
    <div className={cn('flex min-h-0 w-full flex-1 flex-col', className)}>
      {showTabs ? (
        <Tabs
          className="gap-0 sm:hidden"
          selectedKey={activeId}
          onSelectionChange={handleSelectionChange}
        >
          <TabList className="mx-6" variant="default">
            {panes.map((pane) => (
              <Tab key={pane.props.id} id={pane.props.id}>
                {pane.props.label}
              </Tab>
            ))}
          </TabList>
        </Tabs>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
        {panes.map((pane, index) => (
          <div
            key={pane.props.id}
            role="tabpanel"
            className={paneStyles({
              divider: index < panes.length - 1,
              padding: pane.props.unpadded ? 'none' : 'default',
              active: !showTabs || activeId === pane.props.id,
              className: pane.props.className,
            })}
          >
            {pane.props.children}
          </div>
        ))}
      </div>
    </div>
  );
}

export const SplitPane = Object.assign(SplitPaneImpl, { Pane });
