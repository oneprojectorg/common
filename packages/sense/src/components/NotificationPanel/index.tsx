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

function NotificationPanelActions({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
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
