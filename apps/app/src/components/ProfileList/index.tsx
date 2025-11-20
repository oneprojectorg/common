import { RouterOutput } from '@op/api/client';
import { EntityType, Profile } from '@op/api/encoders';

import { Link } from '@/lib/i18n';

import { OrganizationListItem } from '@/components/Organizations/OrganizationListItem';

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
    <div className="flex flex-col gap-6">
      {profiles.map((profile) => {
        const href =
          profile.type === EntityType.INDIVIDUAL
            ? `/profile/${profile.slug}`
            : `/org/${profile.slug}`;

        return (
          <Link key={profile.id} href={href} className="hover:no-underline">
            <div className="flex flex-col gap-3 py-2">
              <OrganizationListItem
                organization={{
                  id: profile.id,
                  profile: {
                    name: profile.name,
                    slug: profile.slug,
                    bio: profile.bio,
                  },
                  avatarImage: profile.avatarImage,
                  whereWeWork: profile.organization?.whereWeWork,
                }}
                showBio={true}
                trimBioLength={325}
                avatarSize="md"
              />
            </div>
          </Link>
        );
      })}
    </div>
  );
};

export const ProfileListSkeleton = () => {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="rounded-lg border bg-white p-4 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="size-12 shrink-0 animate-pulse rounded-full bg-gray-200" />
            <div className="min-w-0 flex-1">
              <div className="mb-2 h-4 animate-pulse rounded bg-gray-200" />
              <div className="mb-2 h-3 w-2/3 animate-pulse rounded bg-gray-200" />
              <div className="mb-1 h-3 w-full animate-pulse rounded bg-gray-200" />
              <div className="h-3 w-3/4 animate-pulse rounded bg-gray-200" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
