'use client';

import { cva } from 'class-variance-authority';
import {
  Children,
  type ReactElement,
  type ReactNode,
  isValidElement,
  useState,
} from 'react';

import { cn } from '../../lib/utils';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';

interface SplitPaneProps {
  /** One or more `SplitPane.Pane` children. */
  children: ReactNode;
  /** Id of the pane shown by default on mobile. Defaults to the first pane. */
  defaultMobileTabId?: string;
  className?: string;
}

interface SplitPanePaneProps {
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
const paneVariants = cva(
  'flex min-w-0 flex-1 flex-col overflow-y-auto [scrollbar-gutter:stable]',
  {
    variants: {
      padding: {
        default: 'px-6 pt-8 pb-4 sm:p-12',
        none: '',
      },
      divider: {
        true: 'sm:border-e',
        false: '',
      },
      active: {
        true: 'flex',
        false: 'hidden sm:flex',
      },
    },
  },
);

function SplitPaneImpl({
  children,
  defaultMobileTabId,
  className,
}: SplitPaneProps) {
  const panes = Children.toArray(children).filter(
    (child): child is ReactElement<SplitPanePaneProps> => isValidElement(child),
  );

  // Fall back to the first pane when defaultMobileTabId matches nothing
  // (stale/typo'd id) — an unmatched id would leave every pane inactive and
  // blank the mobile view. Unlike missing child id/label (structural, thrown
  // below), a bad default is a recoverable convenience-prop mistake.
  const [activeId, setActiveId] = useState<string>(() => {
    const ids = panes.map((pane) => pane.props.id);
    return defaultMobileTabId && ids.includes(defaultMobileTabId)
      ? defaultMobileTabId
      : (panes[0]?.props.id ?? '');
  });

  if (panes.length < 1) {
    return null;
  }

  // Misconfigured children are a programmer error — fail loud.
  for (const pane of panes) {
    if (!pane.props.id || !pane.props.label) {
      throw new Error(
        'SplitPane children must have `id` and `label` props (use SplitPane.Pane).',
      );
    }
  }

  const showTabs = panes.length > 1;

  return (
    <div
      data-slot="split-pane"
      className={cn('flex min-h-0 w-full flex-1 flex-col', className)}
    >
      {showTabs ? (
        <Tabs
          className="gap-0 sm:hidden"
          value={activeId}
          onValueChange={(value) => setActiveId(String(value))}
        >
          <TabsList className="mx-6 w-[calc(100%-3rem)]">
            {panes.map((pane) => (
              <TabsTrigger key={pane.props.id} value={pane.props.id}>
                {pane.props.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
        {panes.map((pane, index) => (
          <div
            key={pane.props.id}
            // Only a tabpanel when the mobile tab bar exists to label it;
            // a lone pane has no tab, so the role would be orphaned.
            role={showTabs ? 'tabpanel' : undefined}
            className={cn(
              paneVariants({
                divider: index < panes.length - 1,
                padding: pane.props.unpadded ? 'none' : 'default',
                active: !showTabs || activeId === pane.props.id,
              }),
              pane.props.className,
            )}
          >
            {pane.props.children}
          </div>
        ))}
      </div>
    </div>
  );
}

const SplitPane = Object.assign(SplitPaneImpl, { Pane });

export { SplitPane };
