import { cn } from '@op/ui/utils';
import { ReactNode } from 'react';

export const FeedItem = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => {
  return <div className={cn('flex gap-2', className)}>{children}</div>;
};

export const FeedContent = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => {
  return (
    <div
      className={cn(
        'flex w-full flex-col gap-2 leading-6 [&>.mediaItem:first-child]:mt-2',
        className,
      )}
      style={{ overflowWrap: 'anywhere' }}
    >
      {children}
    </div>
  );
};

export const FeedHeader = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => {
  return (
    <span className={cn('flex items-center gap-2 align-baseline', className)}>
      {children}
    </span>
  );
};

export const FeedAvatar = ({ children }: { children?: ReactNode }) => {
  return (
    <div className="shadown relative w-8 min-w-8 overflow-hidden">
      {children}
    </div>
  );
};

export const FeedMain = ({
  children,
  className,
  ...props
}: {
  children: ReactNode;
  className?: string;
} & React.HTMLAttributes<HTMLDivElement>) => {
  return (
    <div
      className={cn(
        'flex w-full flex-col items-start justify-start gap-2 overflow-hidden',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
};
