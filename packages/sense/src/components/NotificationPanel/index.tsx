import type { ReactNode } from 'react';

import { cn } from '../../lib/utils';

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
    <h2 className="flex items-center gap-1 p-6 font-serif text-title text-foreground">
      {title}{' '}
      <span className="flex size-4 items-center justify-center rounded-full bg-destructive text-xs text-destructive-foreground">
        {count}
      </span>
    </h2>
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
  return <div className="flex items-center gap-4">{children}</div>;
}

export {
  NotificationPanel,
  NotificationPanelHeader,
  NotificationPanelList,
  NotificationPanelItem,
  NotificationPanelActions,
};
