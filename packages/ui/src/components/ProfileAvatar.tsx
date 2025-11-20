import { ReactNode } from 'react';

type ProfileAvatarProps = {
  avatar: ReactNode;
  title: string;
  description?: string;
  className?: string;
  children?: ReactNode;
};

/**
 * Generic component for displaying a profile with avatar, title, and description.
 */
export const ProfileAvatar = ({
  avatar,
  title,
  description,
  className = '',
  children,
}: ProfileAvatarProps) => {
  const hasAdditionalContent = description || children;

  return (
    <div
      className={`flex gap-2 sm:gap-6 ${hasAdditionalContent ? 'items-start' : 'items-center'} ${className}`}
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
