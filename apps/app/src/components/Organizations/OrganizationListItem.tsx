import { getPublicUrl } from '@/utils';
import type { Organization } from '@op/api/encoders';
import { Avatar, AvatarFallback, AvatarImage } from '@op/sense/Avatar';
import { ProfileItem } from '@op/sense/ProfileItem';
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

  const avatarUrl = organization.avatarImage?.name
    ? (getPublicUrl(organization.avatarImage.name) ?? undefined)
    : undefined;

  return (
    <ProfileItem
      avatar={
        <Avatar>
          {avatarUrl ? (
            <AvatarImage
              src={avatarUrl}
              alt={`${organization.profile.name} avatar`}
            />
          ) : null}
          <AvatarFallback name={organization.profile.name} />
        </Avatar>
      }
      title={organization.profile.name}
      description={whereWeWork || undefined}
    >
      {children}
    </ProfileItem>
  );
};
