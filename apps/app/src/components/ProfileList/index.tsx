import { getPublicUrl } from '@/utils';
import { Avatar } from '@op/ui/Avatar';
import Image from 'next/image';

import { Link } from '@/lib/i18n';

interface ProfileSummaryListProps {
  profiles: Array<{
    id: string;
    type: string;
    name: string;
    slug: string;
    bio?: string | null;
    city?: string | null;
    state?: string | null;
    mission?: string | null;
    email?: string | null;
    website?: string | null;
    avatarImage?: {
      id: string;
      name: string | null;
      metadata: {
        size: number;
        eTag: string;
        mimetype: string;
        cacheControl: string;
        lastModified: string;
        contentLength: number;
        httpStatusCode: number;
      };
    } | null;
  }>;
}

export const ProfileSummaryList = ({ profiles }: ProfileSummaryListProps) => {
  return (
    <div className="flex flex-col gap-6">
      {profiles.map((profile) => {
        const whereWeWork =
          profile.whereWeWork
            ?.map((location: any) => location.name)
            .join(' • ') ?? [];

        const trimmedBio =
          profile.bio && profile.bio.length > 325
            ? `${profile.bio.slice(0, 325)}...`
            : profile.bio;

        return (
          <div key={profile.id}>
            <div className="flex items-start gap-2 py-2 sm:gap-6">
              <Link
                href={
                  profile.type === 'user'
                    ? `/profile/${profile.slug}`
                    : `/org/${profile.slug}`
                }
                className="hover:no-underline"
              >
                <Avatar
                  placeholder={profile.name}
                  className="size-8 hover:opacity-80 sm:size-12"
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

              <div className="flex flex-col gap-3 text-neutral-black">
                <div className="flex flex-col gap-2">
                  <Link
                    href={`/profile/${profile.slug}`}
                    className="font-semibold leading-base"
                  >
                    {profile.name}
                  </Link>
                  {whereWeWork?.length > 0 ? (
                    <span className="text-sm text-neutral-gray4 sm:text-base">
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
