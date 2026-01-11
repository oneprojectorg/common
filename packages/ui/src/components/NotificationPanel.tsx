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
    <Header2 className="text-title-sm text-neutral-black flex items-center gap-1 p-6 font-serif">
      {title}{' '}
      <span className="bg-functional-red text-neutral-offWhite flex size-4 items-center justify-center rounded-full font-sans text-xs">
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
        'border-neutral-gray1 flex flex-col justify-between gap-6 border-t p-6 transition-colors sm:flex-row sm:items-center sm:gap-2',
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
  return <div className="flex items-center gap-4">{children}</div>;
};

export const NotificationPanel = ({ children }: { children: ReactNode }) => {
  return (
    <Surface className="border-neutral-gray1 flex flex-col gap-0 border-b">
      {children}
    </Surface>
  );
};
