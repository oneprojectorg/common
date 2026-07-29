import { useCanLinkToProfile } from '@/hooks/useCanLinkToProfile';
import { getPublicUrl } from '@/utils';
import { Profile } from '@op/api/encoders';
import { ProfileAvatar } from '@op/sense/ProfileAvatar';
import { Skeleton } from '@op/sense/Skeleton';
import { cn } from '@op/sense/lib/utils';
import Image from 'next/image';

import { Link } from '@/lib/i18n';

export const OrganizationAvatar = ({
  profile,
  withLink = true,
  className,
}: {
  profile?: Profile;
  withLink?: boolean;
  className?: string;
}) => {
  const canLinkToProfile = useCanLinkToProfile();

  if (!profile) {
    return null;
  }

  const name = profile?.name ?? '';
  const avatarUrl = profile?.avatarImage?.name
    ? (getPublicUrl(profile.avatarImage.name) ?? undefined)
    : undefined;
  const slug = profile?.slug;
  // Public/non-member viewers can't reach the profile page, so drop the link.
  const linked = withLink && canLinkToProfile && Boolean(slug);

  const avatar = (
    <ProfileAvatar
      name={name}
      src={avatarUrl}
      alt={name}
      className={cn('size-10', linked && 'hover:opacity-80', className)}
      imageRender={
        avatarUrl ? (
          <Image src={avatarUrl} alt={name} fill className="object-cover" />
        ) : undefined
      }
    />
  );

  return linked ? (
    <Link href={`/profile/${slug}`} className="hover:no-underline">
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
      <Skeleton className={cn('size-10 rounded-full', className)} />
    </div>
  );
};
