import { Header2 } from '@op/ui/Header';
import { Surface } from '@op/ui/Surface';
import { cn } from '@op/ui/utils';
import { ReactNode } from 'react';

export const NotificationPanelHeader = ({
  title,
  count,
}: {
  title: string;
  count: number;
}) => {
  return (
    <Header2 className="flex items-center gap-1 p-6 font-serif text-title-sm text-neutral-black">
      {title}{' '}
      <span className="flex size-4 items-center justify-center rounded-full bg-functional-red font-sans text-xs text-neutral-offWhite">
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
        'flex flex-col justify-between gap-6 border-t p-6 transition-colors sm:flex-row sm:items-center sm:gap-2',
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
  return <Surface className="flex flex-col gap-0 border-b">{children}</Surface>;
};
