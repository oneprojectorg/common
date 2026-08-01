import { useCanLinkToProfile } from '@/hooks/useCanLinkToProfile';
import { getPublicUrl } from '@/utils';
import { RouterOutput } from '@op/api/client';
import { EntityType, Profile } from '@op/api/encoders';
import { Skeleton } from '@op/sense/Skeleton';

import { Link } from '@/lib/i18n';

import { ProfileAvatarLink } from '../ProfileAvatarLink';

type Profiles = RouterOutput['profile']['list']['items'];

// Flexible profile type that works with both list and search results
type ProfileItem = Pick<Profile, 'id' | 'name' | 'slug' | 'type' | 'bio'> & {
  avatarImage?: { name: string | null } | null;
  organization?: {
    whereWeWork?: Array<{ name: string }>;
  } | null;
};

export const ProfileSummaryList = ({
  profiles,
}: {
  profiles: Profiles | ProfileItem[];
}) => {
  // Public/non-member viewers can't reach profile pages, so render names and
  // avatars as plain text/images without links.
  const canLinkToProfile = useCanLinkToProfile();
  return (
    <div className="flex flex-col gap-6">
      {profiles.map((profile) => {
        const whereWeWork =
          profile.organization?.whereWeWork
            ?.map((location) => location.name)
            .join(' • ') ?? [];

        const trimmedBio =
          profile.bio && profile.bio.length > 325
            ? `${profile.bio.slice(0, 325)}...`
            : profile.bio;

        const profileHref =
          profile.type === EntityType.INDIVIDUAL
            ? `/profile/${profile.slug}`
            : `/org/${profile.slug}`;

        return (
          <div key={profile.id}>
            <div className="flex items-start gap-2 py-2 sm:gap-4">
              <ProfileAvatarLink
                href={profileHref}
                name={profile.name}
                src={getPublicUrl(profile.avatarImage?.name) ?? ''}
                alt={profile.name}
                size="lg"
                className="size-8 sm:size-12"
              />

              <div className="flex flex-col gap-3 text-foreground">
                <div className="flex flex-col gap-2">
                  {canLinkToProfile ? (
                    <Link
                      href={`/profile/${profile.slug}`}
                      className="leading-base font-semibold"
                    >
                      <bdi>{profile.name}</bdi>
                    </Link>
                  ) : (
                    <span className="leading-base font-semibold">
                      <bdi>{profile.name}</bdi>
                    </span>
                  )}
                  {whereWeWork?.length > 0 ? (
                    <span
                      dir="auto"
                      className="text-sm text-muted-foreground sm:text-base"
                    >
                      {whereWeWork}
                    </span>
                  ) : null}
                </div>
                <span dir="auto" className="text-foreground">
                  {trimmedBio}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const ProfileListSkeleton = () => {
  return (
    <div className="grid grid-cols-1 gap-4">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="rounded-lg border bg-card p-4 shadow-xs">
          <div className="flex items-start gap-4">
            <Skeleton className="size-12 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1">
              <Skeleton className="mb-2 h-4" />
              <Skeleton className="mb-2 h-3 w-2/3" />
              <Skeleton className="mb-1 h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
