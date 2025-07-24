import { getPublicUrl } from '@/utils';
import { Profile } from '@op/api/encoders';
import { Avatar, AvatarSkeleton } from '@op/ui/Avatar';
import { cn } from '@op/ui/utils';
import Image from 'next/image';

import { Link } from '@/lib/i18n';

export const OrganizationAvatar = ({
  organization,
  withLink = true,
  className,
}: {
  organization?: { profile?: Profile };
  withLink?: boolean;
  className?: string;
}) => {
  if (!organization) {
    return null;
  }

  const profile = 'profile' in organization ? organization.profile : null;

  const name = profile?.name ?? '';
  const avatarImage = profile?.avatarImage;
  const slug = profile?.slug;

  const avatar = (
    <Avatar
      className={cn('size-12', withLink && 'hover:opacity-80', className)}
      placeholder={name ?? ''}
    >
      {avatarImage?.name ? (
        <Image
          src={getPublicUrl(avatarImage?.name) ?? ''}
          alt={name ?? ''}
          fill
          className="object-cover"
        />
      ) : null}
    </Avatar>
  );

  return withLink ? (
    <Link href={`/org/${slug}`} className="hover:no-underline">
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
