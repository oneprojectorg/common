import { useCanLinkToProfile } from '@/hooks/useCanLinkToProfile';
import { getPublicUrl } from '@/utils';
import { Profile } from '@op/api/encoders';
import { Skeleton } from '@op/sense/Skeleton';
import { cn } from '@op/sense/lib/utils';

import { ProfileAvatarLink } from '../ProfileAvatarLink';

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

  return (
    <ProfileAvatarLink
      href={linked ? `/profile/${slug}` : undefined}
      name={name}
      src={avatarUrl}
      alt={name}
      className={className}
    />
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
