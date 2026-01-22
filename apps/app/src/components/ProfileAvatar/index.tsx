import { getPublicUrl } from '@/utils';
import { Avatar, AvatarSkeleton } from '@op/ui/Avatar';
import { cn } from '@op/ui/utils';
import Image from 'next/image';

import { Link } from '@/lib/i18n';

type ProfileAvatarProps = {
  profile?: {
    name?: string | null;
    slug?: string | null;
    avatarImage?: { name?: string | null } | null;
  } | null;
  withLink?: boolean;
  className?: string;
};

export const ProfileAvatar = ({
  profile,
  withLink = true,
  className,
}: ProfileAvatarProps) => {
  if (!profile) {
    return null;
  }

  const name = profile?.name ?? '';
  const avatarImage = profile?.avatarImage;
  const slug = profile?.slug;

  const avatar = (
    <Avatar
      className={cn('size-6', withLink && 'hover:opacity-80', className)}
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

  return withLink && slug ? (
    <Link href={`/profile/${slug}`} className="hover:no-underline">
      {avatar}
    </Link>
  ) : (
    avatar
  );
};

export const ProfileAvatarSkeleton = ({
  className,
}: {
  className?: string;
}) => {
  return <AvatarSkeleton className={cn('size-6', className)} />;
};
