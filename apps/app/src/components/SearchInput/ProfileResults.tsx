import { Avatar } from '@op/ui/Avatar';
import Image from 'next/image';

import { getPublicUrl } from '@/utils';
import { Link } from '@/lib/i18n';

import { SearchResultItem } from './SearchResultItem';

interface ProfileResultsProps {
  query: string;
  profileResults: Array<{
    id: string;
    type: 'user' | 'org';
    name: string;
    slug: string;
    bio?: string | null;
    city?: string | null;
    avatarImage?: {
      id: string;
      name: string;
      path: string;
      size: number;
      mimetype: string;
    } | null;
  }>;
  selectedIndex: number;
  onSearch: (query: string) => void;
}

export const ProfileResults = ({
  query,
  profileResults,
  selectedIndex,
  onSearch,
}: ProfileResultsProps) => {
  return (
    <div className="pb-4">
      {profileResults.map((profile, index) => (
        <SearchResultItem key={profile.id} selected={selectedIndex === index + 1}>
          <Link
            className="group/result flex w-full items-center gap-4 hover:no-underline"
            href={profile.type === 'user' ? `/profile/${profile.slug}` : `/org/${profile.slug}`}
            onClick={() => onSearch(query)}
          >
            <Avatar placeholder={profile.name} className="size-8 group-hover/result:no-underline">
              {profile.avatarImage?.name ? (
                <Image
                  src={getPublicUrl(profile.avatarImage.name) ?? ''}
                  alt={`${profile.name} avatar`}
                  fill
                  className="object-cover"
                />
              ) : null}
            </Avatar>

            <div className="flex flex-col font-semibold text-neutral-charcoal group-hover/result:underline">
              <span>{profile.name}</span>
              <span className="text-sm text-neutral-gray4 capitalize">
                {profile.type === 'user' ? 'Personal' : 'Organization'}
                {profile.city && ` • ${profile.city}`}
              </span>
            </div>
          </Link>
        </SearchResultItem>
      ))}
    </div>
  );
};