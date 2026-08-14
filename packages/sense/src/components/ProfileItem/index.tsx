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
 * — pass a rendered avatar; the consumer owns data. `dir="auto"` on text so
 * RTL names/descriptions resolve their own direction.
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
        {/* `dir="auto"` gets the ordering (and the ellipsis side) from the
            content; `match-parent` keeps the *alignment* on the page, so a row
            of mixed-language items doesn't align every other one differently. */}
        <div
          dir="auto"
          className={cn(
            titleClasses[size],
            'truncate [text-align:match-parent]',
            titleClassName,
          )}
        >
          {title}
        </div>
        {description ? (
          <div
            dir="auto"
            className={cn(
              'truncate [text-align:match-parent] text-sm font-normal text-muted-foreground',
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
