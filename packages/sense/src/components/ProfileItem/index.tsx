import type { ReactNode } from 'react';

import { cn } from '../../lib/utils';

type ProfileItemSize = 'default' | 'small';

interface ProfileItemProps {
  /** Rendered avatar element (pass a sense Avatar). */
  avatar: ReactNode;
  title: string;
  titleClassName?: string;
  description?: string;
  descriptionClassName?: string;
  /** Title emphasis: `default` (strong foreground) or `small` (muted). */
  size?: ProfileItemSize;
  className?: string;
  children?: ReactNode;
}

const titleClasses: Record<ProfileItemSize, string> = {
  default: 'text-base font-strong text-foreground',
  small: 'text-sm text-foreground',
};

/**
 * Avatar + title (+ optional description / trailing content) row. Presentational
 * — pass a rendered avatar; the consumer owns data. Title and description take
 * their direction from the content and their alignment from the page, so a name
 * running counter to the page still truncates from its own tail.
 */
function ProfileItem({
  avatar,
  title,
  titleClassName,
  description,
  descriptionClassName,
  size = 'default',
  className,
  children,
}: ProfileItemProps) {
  return (
    <div className={cn('flex min-w-0 gap-3 text-start', className)}>
      {avatar}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {/* A truncating block needs `dir` from its own content — the ellipsis
            lands at the block's direction end, so an RTL block would clip the
            *head* off an English name. Alignment then has to be pinned back to
            the page, which is the one place physical `text-left`/`text-right`
            is the point rather than a bug: `start` would follow the content. */}
        <div
          dir="auto"
          className={cn(
            titleClasses[size],
            'truncate ltr:text-left rtl:text-right',
            titleClassName,
          )}
        >
          {title}
        </div>
        {description ? (
          <div
            dir="auto"
            className={cn(
              'truncate text-sm font-normal text-muted-foreground ltr:text-left rtl:text-right',
              descriptionClassName,
            )}
          >
            {description}
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}

export { ProfileItem, type ProfileItemProps };
