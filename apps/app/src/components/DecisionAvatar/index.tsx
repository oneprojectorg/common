import { getPublicUrl } from '@/utils';
import { Profile } from '@op/api/encoders';
import { Skeleton } from '@op/sense/Skeleton';
import { cn } from '@op/sense/lib/utils';

import { ProfileAvatarLink } from '../ProfileAvatarLink';

export const DecisionAvatar = ({
  profile,
  withLink = true,
  className,
}: {
  profile?: Profile;
  withLink?: boolean;
  className?: string;
}) => {
  if (!profile) {
    return null;
  }

  const name = profile?.name ?? '';
  const avatarUrl = profile?.avatarImage?.name
    ? (getPublicUrl(profile.avatarImage.name) ?? undefined)
    : undefined;
  const slug = profile?.slug;

  return (
    <ProfileAvatarLink
      href={withLink && slug ? `/decisions/${slug}` : undefined}
      name={name}
      src={avatarUrl}
      alt={name}
      size="lg"
      className={className}
    />
  );
};

export const DecisionAvatarSkeleton = ({
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
