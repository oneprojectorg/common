import { getPublicUrl } from '@/utils';
import type { Organization } from '@op/api/encoders';
import { Avatar } from '@op/ui/Avatar';
import { ProfileItem } from '@op/ui/ProfileItem';
import Image from 'next/image';
import { ReactNode } from 'react';

type OrganizationForList = Pick<
  Organization,
  'id' | 'avatarImage' | 'whereWeWork'
> & {
  profile: Pick<Organization['profile'], 'name' | 'slug' | 'bio'>;
};

type OrganizationListItemProps = {
  organization: OrganizationForList;
  children?: ReactNode;
};

/**
 * Reusable component for displaying organization information consistently
 * across the application (avatar, name, location).
 */
export const OrganizationListItem = ({
  organization,
  children,
}: OrganizationListItemProps) => {
  const whereWeWork =
    organization.whereWeWork
      ?.map((location) => location.name)
      .filter((name): name is string => !!name)
      .join(' • ') ?? '';

  const avatar = (
    <Avatar placeholder={organization.profile.name} className="size-8 shrink-0">
      {organization.avatarImage?.name ? (
        <Image
          src={getPublicUrl(organization.avatarImage.name) ?? ''}
          alt={`${organization.profile.name} avatar`}
          fill
          className="object-cover"
        />
      ) : null}
    </Avatar>
  );

  const description =
    whereWeWork && whereWeWork.length > 0 ? (
      <div className="text-neutral-gray4 mt-1 truncate text-sm sm:text-base">
        {whereWeWork}
      </div>
    ) : null;

  return (
    <ProfileItem avatar={avatar} title={organization.profile.name}>
      {description}
      {children}
    </ProfileItem>
  );
};
