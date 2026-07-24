import type { ReactNode } from 'react';

import { cn } from '../../lib/utils';

type ProfileItemSize = 'default' | 'small';

interface ProfileItemProps {
  /** Rendered avatar element (pass a sense Avatar). */
  avatar: ReactNode;
  title: string;
  description?: string;
  /** Title emphasis: `default` (semibold foreground) or `small` (muted). */
  size?: ProfileItemSize;
  className?: string;
  children?: ReactNode;
}

const titleClasses: Record<ProfileItemSize, string> = {
  default: 'font-semibold text-foreground',
  small: 'text-base text-muted-foreground',
};

/**
 * Avatar + title (+ optional description / trailing content) row. Presentational
 * — pass a rendered avatar; the consumer owns data. `dir="auto"` on text so
 * RTL names/descriptions resolve their own direction.
 */
function ProfileItem({
  avatar,
  title,
  description,
  size = 'default',
  className,
  children,
}: ProfileItemProps) {
  const hasAdditionalContent = Boolean(description || children);

  return (
    <div
      className={cn(
        'flex gap-3',
        hasAdditionalContent ? 'items-start' : 'items-center',
        className,
      )}
    >
      {avatar}
      <div className="min-w-0 flex-1">
        <div dir="auto" className={titleClasses[size]}>
          {title}
        </div>
        {description ? (
          <div dir="auto" className="mt-2 text-muted-foreground">
            {description}
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}

export { ProfileItem, type ProfileItemProps };
