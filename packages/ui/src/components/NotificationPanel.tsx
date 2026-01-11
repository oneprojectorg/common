import { ReactNode } from 'react';

import { cn } from '../lib/utils';
import { Header2 } from './Header';
import { Surface } from './Surface';

export const NotificationPanelHeader = ({
  title,
  count,
}: {
  title: string;
  count: number;
}) => {
  return (
    <Header2 className="gap-1 p-6 flex items-center font-serif text-title-sm text-neutral-black">
      {title}{' '}
      <span className="size-4 flex items-center justify-center rounded-full bg-functional-red font-sans text-xs text-neutral-offWhite">
        {count}
      </span>
    </Header2>
  );
};

export const NotificationPanelList = ({
  children,
}: {
  children: ReactNode;
}) => {
  return <ul className="flex flex-col">{children}</ul>;
};

export const NotificationPanelItem = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => {
  return (
    <li
      className={cn(
        'gap-6 p-6 sm:flex-row sm:items-center sm:gap-2 flex flex-col justify-between border-t transition-colors',
        className,
      )}
    >
      {children}
    </li>
  );
};

export const NotificationPanelActions = ({
  children,
}: {
  children: ReactNode;
}) => {
  return <div className="gap-4 flex items-center">{children}</div>;
};

export const NotificationPanel = ({ children }: { children: ReactNode }) => {
  return (
    <Surface className="gap-0 flex flex-col border-b">
      {children}
    </Surface>
  );
};
