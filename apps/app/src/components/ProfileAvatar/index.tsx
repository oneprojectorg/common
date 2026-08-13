import { useCanLinkToProfile } from '@/hooks/useCanLinkToProfile';
import { getPublicUrl } from '@/utils';
import { Skeleton } from '@op/sense/Skeleton';
import { cn } from '@op/sense/lib/utils';

import { ProfileAvatarLink } from '../ProfileAvatarLink';

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

/**
 * A profile's avatar, linked to its page when the viewer can reach it.
 *
 * Resolves profile → name / image URL / slug, then delegates to
 * `ProfileAvatarLink` so every linked avatar in the app shares one focus ring and
 * hover treatment. (Rolling its own link is what left these with the browser's
 * default focus ring.)
 */
export const ProfileAvatar = ({
  profile,
  withLink = true,
  className,
}: ProfileAvatarProps) => {
  const canLinkToProfile = useCanLinkToProfile();
  const name = profile?.name ?? '';
  const email = profile?.email ?? '';
  // The fallback initial + gradient seed: a profile may have no name yet.
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

  return (
    <ProfileAvatarLink
      href={linked ? `/profile/${slug}` : undefined}
      name={placeholderSeed}
      src={src}
      alt={name}
      className={cn('size-6', className)}
    />
  );
};

export const ProfileAvatarSkeleton = ({
  className,
}: {
  className?: string;
}) => {
  return <Skeleton className={cn('size-6 rounded-full', className)} />;
};
