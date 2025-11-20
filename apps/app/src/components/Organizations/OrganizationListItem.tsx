import { getPublicUrl } from '@/utils';
import { Avatar } from '@op/ui/Avatar';
import Image from 'next/image';
import { ReactNode } from 'react';

type Organization = {
  id: string;
  profile: {
    name: string;
    slug: string;
    bio?: string | null;
  };
  avatarImage?: { name: string | null } | null;
  whereWeWork?: Array<{ name?: string | null }>;
};

type OrganizationListItemProps = {
  organization: Organization;
  showBio?: boolean;
  trimBioLength?: number;
  className?: string;
  avatarSize?: 'sm' | 'md' | 'lg';
  children?: ReactNode;
};

/**
 * Reusable component for displaying organization information consistently
 * across the application (avatar, name, location, bio).
 */
export const OrganizationListItem = ({
  organization,
  showBio = true,
  trimBioLength = 325,
  className = '',
  avatarSize = 'md',
  children,
}: OrganizationListItemProps) => {
  const whereWeWork =
    organization.whereWeWork
      ?.map((location) => location.name)
      .filter((name): name is string => !!name)
      .join(' • ') ?? '';

  const trimmedBio =
    showBio && organization.profile.bio
      ? organization.profile.bio.length > trimBioLength
        ? `${organization.profile.bio.slice(0, trimBioLength)}...`
        : organization.profile.bio
      : null;

  const avatarSizeClasses = {
    sm: 'size-8',
    md: 'size-8 sm:size-12',
    lg: 'size-12',
  };

  const hasAdditionalContent =
    (whereWeWork && whereWeWork.length > 0) || trimmedBio || children;

  return (
    <div
      className={`flex gap-2 sm:gap-6 ${hasAdditionalContent ? 'items-start' : 'items-center'} ${className}`}
    >
      <Avatar
        placeholder={organization.profile.name}
        className={`${avatarSizeClasses[avatarSize]} shrink-0`}
      >
        {organization.avatarImage?.name ? (
          <Image
            src={getPublicUrl(organization.avatarImage.name) ?? ''}
            alt={`${organization.profile.name} avatar`}
            fill
            className="object-cover"
          />
        ) : null}
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="font-semibold leading-base text-neutral-black">
          {organization.profile.name}
        </div>

        {whereWeWork && whereWeWork.length > 0 ? (
          <div className="mt-1 text-sm text-neutral-gray4 sm:text-base">
            {whereWeWork}
          </div>
        ) : null}

        {trimmedBio ? (
          <div className="mt-2 text-neutral-charcoal">{trimmedBio}</div>
        ) : null}

        {children}
      </div>
    </div>
  );
};
