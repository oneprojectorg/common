import type { ReactNode } from 'react';

import { cn } from '../../lib/utils';
import { Header2 } from '../Header';
import { BadgeNumber } from '../ui/badge';

/**
 * A bordered notification surface with a serif header (title + count badge),
 * a list of items, and per-item action groups. Composed from tokens — the
 * consumer supplies the rows via NotificationPanelList / -Item / -Actions.
 */
function NotificationPanel({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border bg-card">
      {children}
    </div>
  );
}

function NotificationPanelHeader({
  title,
  count,
}: {
  title: string;
  count: number;
}) {
  return (
    <div className="flex items-center gap-1 p-6 text-foreground">
      <Header2 className="text-title">{title}</Header2>
      <BadgeNumber>{count}</BadgeNumber>
    </div>
  );
}

function NotificationPanelList({ children }: { children: ReactNode }) {
  return <ul className="flex flex-col">{children}</ul>;
}

function NotificationPanelItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <li
      className={cn(
        'flex flex-col justify-between gap-6 border-t p-6 transition-colors sm:flex-row sm:items-center sm:gap-2',
        className,
      )}
    >
      {children}
    </li>
  );
}

/**
 * The action group for a row. Stacks its buttons on narrow viewports and turns
 * into a row at `sm`, matching NotificationPanelItem's own breakpoint — so a
 * call site's `w-full sm:w-auto` buttons get a container that honours the
 * full-width half. A row here at every width overflows the card instead:
 * `Button` is `shrink-0`, so two `w-full` siblings can't shrink to share it.
 */
function NotificationPanelActions({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      {children}
    </div>
  );
}

export {
  NotificationPanel,
  NotificationPanelHeader,
  NotificationPanelList,
  NotificationPanelItem,
  NotificationPanelActions,
};
