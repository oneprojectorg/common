import { ReactNode } from 'react';

import { cn } from '../lib/utils';

type ProfileItemProps = {
  avatar: ReactNode;
  title: string;
  description?: string;
  className?: string;
  children?: ReactNode;
};

/**
 * Generic component for displaying a profile with avatar, title, and description.
 */
export const ProfileItem = ({
  avatar,
  title,
  description,
  className,
  children,
}: ProfileItemProps) => {
  const hasAdditionalContent = description || children;

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
        <div className="font-semibold leading-base text-neutral-black">
          {title}
        </div>

        {description ? (
          <div className="mt-2 text-neutral-charcoal">{description}</div>
        ) : null}

        {children}
      </div>
    </div>
  );
};
