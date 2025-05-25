import { getPublicUrl } from '@/utils';
import { RouterOutput } from '@op/api/client';
import { Avatar, AvatarSkeleton } from '@op/ui/Avatar';
import { cn } from '@op/ui/utils';
import Image from 'next/image';

import { Link } from '@/lib/i18n';

type relationshipOrganization =
  | RouterOutput['organization']['listRelationships']['organizations'][number]
  | RouterOutput['organization']['list'][number]
  | RouterOutput['organization']['listPosts'][number]['organization'];

export const OrganizationAvatar = ({
  organization,
  className,
}: {
  organization: relationshipOrganization;
  className?: string;
}) => {
  if (!organization) {
    return null;
  }

  return (
    <Link href={`/org/${organization.slug}`}>
      <Avatar
        className={cn('size-12', className)}
        placeholder={organization.name}
      >
        {
          // @ts-expect-error
          organization.avatarImage?.name ? (
            <Image
              src={
                getPublicUrl(
                  // @ts-expect-error
                  organization.avatarImage?.name,
                ) ?? ''
              }
              width={80}
              height={80}
              alt={organization.name}
            />
          ) : null
        }
      </Avatar>
    </Link>
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
