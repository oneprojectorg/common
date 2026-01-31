import { ReactNode } from 'react';
import { VariantProps, tv } from 'tailwind-variants';

import { cn } from '../lib/utils';

const profileItemStyles = tv({
  slots: {
    root: 'flex gap-3',
    title: '',
  },
  variants: {
    size: {
      default: {
        title: 'leading-base font-semibold text-neutral-black',
      },
      small: {
        title: 'text-sm font-medium text-neutral-charcoal',
      },
    },
  },
  defaultVariants: {
    size: 'default',
  },
});

type ProfileItemProps = VariantProps<typeof profileItemStyles> & {
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
  size,
}: ProfileItemProps) => {
  const hasAdditionalContent = description || children;
  const styles = profileItemStyles({ size });

  return (
    <div
      className={cn(
        styles.root(),
        hasAdditionalContent ? 'items-start' : 'items-center',
        className,
      )}
    >
      {avatar}

      <div className="min-w-0 flex-1">
        <div className={styles.title()}>{title}</div>

        {description ? (
          <div className="mt-2 text-neutral-charcoal">{description}</div>
        ) : null}

        {children}
      </div>
    </div>
  );
};
