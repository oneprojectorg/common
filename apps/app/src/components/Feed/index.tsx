import { cn } from '@op/ui/utils';
import { ReactNode } from 'react';

export const FeedItem = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => {
  return (
    <div className={cn('gap-2 flex items-start', className)}>{children}</div>
  );
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
        'gap-2 leading-6 [&>.mediaItem:first-child]:mt-2 flex w-full flex-col',
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
    <span className={cn('gap-2 flex items-center align-baseline', className)}>
      {children}
    </span>
  );
};

export const FeedAvatar = ({ children }: { children?: ReactNode }) => {
  return (
    <div className="shadown w-8 min-w-8 relative overflow-hidden">
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
        'gap-2 flex w-full flex-col items-start justify-start overflow-hidden',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
};
