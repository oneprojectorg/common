import type { ReactNode } from 'react';
import { Link as AriaLink } from 'react-aria-components';

import { cn } from '../lib/utils';
import { Surface } from './Surface';

export interface OrganizationCardProps {
  headerImage?: ReactNode;
  avatarImage?: ReactNode;
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  href?: string;
  className?: string;
  onClick?: () => void;
}

export const OrganizationCard = ({
  headerImage,
  avatarImage,
  title,
  subtitle,
  badge,
  href,
  className,
  onClick,
}: OrganizationCardProps) => {
  const content = (
    <Surface className={cn('flex w-48 flex-col overflow-hidden', className)}>
      <div className="relative w-full">
        <div className="relative aspect-[72/31] w-full bg-neutral-offWhite">
          {headerImage}
        </div>
        {badge ? (
          <div className="absolute right-3 top-3">{badge}</div>
        ) : null}
        <div className="absolute -bottom-8 left-4 aspect-square size-16 overflow-hidden rounded-full border-2 border-white bg-neutral-offWhite shadow">
          {avatarImage}
        </div>
      </div>
      <div className="flex flex-col gap-1 p-4 pt-10 text-left">
        <span className="font-medium text-neutral-black">{title}</span>
        {subtitle ? (
          <span className="text-sm text-neutral-gray3">{subtitle}</span>
        ) : null}
      </div>
    </Surface>
  );

  if (href) {
    return (
      <AriaLink
        href={href}
        className="no-underline hover:opacity-90"
        onPress={onClick}
      >
        {content}
      </AriaLink>
    );
  }

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="cursor-pointer text-left hover:opacity-90"
      >
        {content}
      </button>
    );
  }

  return content;
};
