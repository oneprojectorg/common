import { Avatar } from '@op/ui/Avatar';
import Image from 'next/image';

import { getPublicUrl } from '@/utils';
import { Link } from '@/lib/i18n';

interface ProfileSummaryListProps {
  profiles: Array<{
    id: string;
    type: 'user' | 'org';
    name: string;
    slug: string;
    bio?: string | null;
    city?: string | null;
    state?: string | null;
    mission?: string | null;
    avatarImage?: {
      id: string;
      name: string;
      path: string;
      size: number;
      mimetype: string;
    } | null;
  }>;
}

export const ProfileSummaryList = ({ profiles }: ProfileSummaryListProps) => {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {profiles.map((profile) => (
        <div key={profile.id} className="rounded-lg border bg-white p-4 shadow-sm">
          <Link
            href={profile.type === 'user' ? `/profile/${profile.slug}` : `/org/${profile.slug}`}
            className="group flex items-start gap-4 hover:no-underline"
          >
            <Avatar placeholder={profile.name} className="size-12 shrink-0">
              {profile.avatarImage?.name ? (
                <Image
                  src={getPublicUrl(profile.avatarImage.name) ?? ''}
                  alt={`${profile.name} avatar`}
                  fill
                  className="object-cover"
                />
              ) : null}
            </Avatar>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-neutral-charcoal group-hover:underline">
                  {profile.name}
                </h3>
                <span className="text-xs text-neutral-gray4 capitalize">
                  {profile.type === 'user' ? 'Personal' : 'Organization'}
                </span>
              </div>

              {(profile.city || profile.state) && (
                <p className="text-sm text-neutral-gray4">
                  {[profile.city, profile.state].filter(Boolean).join(', ')}
                </p>
              )}

              {(profile.bio || profile.mission) && (
                <p className="mt-2 text-sm text-neutral-gray3 line-clamp-3">
                  {profile.bio || profile.mission}
                </p>
              )}
            </div>
          </Link>
        </div>
      ))}
    </div>
  );
};

export const ProfileListSkeleton = () => {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="rounded-lg border bg-white p-4 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="size-12 shrink-0 rounded-full bg-gray-200 animate-pulse" />
            <div className="min-w-0 flex-1">
              <div className="h-4 bg-gray-200 rounded animate-pulse mb-2" />
              <div className="h-3 bg-gray-200 rounded animate-pulse w-2/3 mb-2" />
              <div className="h-3 bg-gray-200 rounded animate-pulse w-full mb-1" />
              <div className="h-3 bg-gray-200 rounded animate-pulse w-3/4" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};