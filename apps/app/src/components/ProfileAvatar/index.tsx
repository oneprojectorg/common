import { useCanLinkToProfile } from '@/hooks/useCanLinkToProfile';
import { getPublicUrl } from '@/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@op/sense/Avatar';
import { Skeleton } from '@op/sense/Skeleton';
import { cn } from '@op/sense/lib/utils';
import Image from 'next/image';

import { Link } from '@/lib/i18n';

type ProfileAvatarProps = {
  profile?: {
    name?: string | null;
    email?: string | null;
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
  const canLinkToProfile = useCanLinkToProfile();
  const name = profile?.name ?? '';
  const email = profile?.email ?? '';
  const placeholderSeed = name || email;

  if (!placeholderSeed) {
    return null;
  }

  const slug = profile?.slug;
  // Public/non-member viewers can't reach the profile page, so drop the link.
  const linked = withLink && canLinkToProfile && Boolean(slug);
  const src = profile?.avatarImage?.name
    ? (getPublicUrl(profile.avatarImage.name) ?? undefined)
    : undefined;

  const avatar = (
    <Avatar className={cn('size-6', linked && 'hover:opacity-80', className)}>
      {src ? (
        <AvatarImage
          src={src}
          alt={name}
          render={<Image src={src} alt={name} fill className="object-cover" />}
        />
      ) : null}
      <AvatarFallback name={placeholderSeed} />
    </Avatar>
  );

  return linked ? (
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
  return <Skeleton className={cn('size-6 rounded-full', className)} />;
};
