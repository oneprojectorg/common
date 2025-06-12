import { getPublicUrl } from '@/utils';
import { RouterOutput } from '@op/api/client';
import { Avatar, AvatarSkeleton } from '@op/ui/Avatar';
import { cn } from '@op/ui/utils';
import Image from 'next/image';

import { Link } from '@/lib/i18n';

type relationshipOrganization =
  | RouterOutput['organization']['listRelationships']['organizations'][number]
  | RouterOutput['organization']['list']['items'][number]
  | RouterOutput['organization']['listPosts']['items'][number]['organization'];

export const OrganizationAvatar = ({
  organization,
  withLink = true,
  className,
}: {
  organization: relationshipOrganization;
  withLink?: boolean;
  className?: string;
}) => {
  if (!organization) {
    return null;
  }

  const avatar = (
    <Avatar
      className={cn('size-12', withLink && 'hover:opacity-80', className)}
      placeholder={organization.name}
    >
      {'avatarImage' in organization && organization.avatarImage?.name ? (
        <Image
          src={getPublicUrl(organization.avatarImage?.name) ?? ''}
          alt={organization.name}
          fill
          className="object-cover"
        />
      ) : null}
    </Avatar>
  );

  return withLink ? (
    <Link href={`/org/${organization.slug}`} className="hover:no-underline">
      {avatar}
    </Link>
  ) : (
    <div>{avatar}</div>
  );
};

export const OrganizationAvatarSkeleton = ({
  className,
}: {
  className?: string;
}) => {
  return (
    <div>
      <AvatarSkeleton className={cn('size-12', className)} />
    </div>
  );
};
