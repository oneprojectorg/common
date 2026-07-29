import { getPublicUrl } from '@/utils';
import { Profile } from '@op/api/encoders';
import { ProfileAvatar } from '@op/sense/ProfileAvatar';
import { Skeleton } from '@op/sense/Skeleton';
import { cn } from '@op/sense/lib/utils';
import Image from 'next/image';

import { Link } from '@/lib/i18n';

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

  const avatar = (
    <ProfileAvatar
      name={name}
      src={avatarUrl}
      alt={name}
      size="lg"
      className={cn(withLink && slug && 'hover:opacity-80', className)}
      imageRender={
        avatarUrl ? (
          <Image src={avatarUrl} alt={name} fill className="object-cover" />
        ) : undefined
      }
    />
  );

  return withLink && slug ? (
    <Link href={`/decisions/${slug}`} className="hover:no-underline">
      {avatar}
    </Link>
  ) : (
    <div>{avatar}</div>
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
