import { getPublicUrl } from '@/utils';
import { RouterOutput } from '@op/api/client';
import { EntityType, Profile } from '@op/api/encoders';
import { Avatar } from '@op/ui/Avatar';
import Image from 'next/image';

import { Link } from '@/lib/i18n';

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
  return (
    <div className="gap-6 flex flex-col">
      {profiles.map((profile) => {
        const whereWeWork =
          profile.organization?.whereWeWork
            ?.map((location) => location.name)
            .join(' • ') ?? [];

        const trimmedBio =
          profile.bio && profile.bio.length > 325
            ? `${profile.bio.slice(0, 325)}...`
            : profile.bio;

        return (
          <div key={profile.id}>
            <div className="gap-2 py-2 sm:gap-6 flex items-start">
              <Link
                href={
                  profile.type === EntityType.INDIVIDUAL
                    ? `/profile/${profile.slug}`
                    : `/org/${profile.slug}`
                }
                className="hover:no-underline"
              >
                <Avatar
                  placeholder={profile.name}
                  className="size-8 sm:size-12 hover:opacity-80"
                >
                  {profile.avatarImage?.name ? (
                    <Image
                      src={getPublicUrl(profile.avatarImage.name) ?? ''}
                      alt={`${profile.name} avatar`}
                      fill
                      className="object-cover"
                    />
                  ) : null}
                </Avatar>
              </Link>

              <div className="gap-3 flex flex-col text-neutral-black">
                <div className="gap-2 flex flex-col">
                  <Link
                    href={`/profile/${profile.slug}`}
                    className="font-semibold leading-base"
                  >
                    {profile.name}
                  </Link>
                  {whereWeWork?.length > 0 ? (
                    <span className="sm:text-base text-sm text-neutral-gray4">
                      {whereWeWork}
                    </span>
                  ) : null}
                </div>
                <span className="text-neutral-charcoal">{trimmedBio}</span>
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
    <div className="gap-4 sm:grid-cols-2 lg:grid-cols-3 grid grid-cols-1">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="shadow-xs p-4 rounded-lg border border-neutral-gray1 bg-white"
        >
          <div className="gap-4 flex items-start">
            <div className="size-12 bg-gray-200 shrink-0 animate-pulse rounded-full" />
            <div className="min-w-0 flex-1">
              <div className="mb-2 h-4 bg-gray-200 animate-pulse rounded" />
              <div className="mb-2 h-3 bg-gray-200 w-2/3 animate-pulse rounded" />
              <div className="mb-1 h-3 bg-gray-200 w-full animate-pulse rounded" />
              <div className="h-3 bg-gray-200 w-3/4 animate-pulse rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
