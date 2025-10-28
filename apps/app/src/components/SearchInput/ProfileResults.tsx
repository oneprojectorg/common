import { getPublicUrl } from '@/utils';
import { EntityType, Profile } from '@op/api/encoders';
import { Avatar } from '@op/ui/Avatar';
import Image from 'next/image';

import { Link } from '@/lib/i18n';

import { SearchResultItem } from './SearchResultItem';

interface ProfileResultsProps {
  query: string;
  profileResults: Array<Profile>;
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
      {profileResults.map((profile, index) => {
        // Set up the subtitle that appears in search results
        const isIndividual = profile.type === EntityType.INDIVIDUAL;
        const profileType = isIndividual ? 'Individual' : 'Organization';

        let additionalInfo: string | undefined;
        if (isIndividual) {
          additionalInfo = profile.bio;
        } else {
          const locationParts = [profile.city, profile.state].filter(Boolean);
          additionalInfo =
            locationParts.length > 0 ? locationParts.join(', ') : undefined;
        }

        const subtitle = additionalInfo
          ? `${profileType} • ${additionalInfo}`
          : profileType;

        return (
          <SearchResultItem
            key={profile.id}
            selected={selectedIndex === index + 1}
          >
            <Link
              className="group/result flex w-full items-center gap-4 hover:no-underline"
              href={
                isIndividual
                  ? `/profile/${profile.slug}`
                  : `/org/${profile.slug}`
              }
              onClick={() => onSearch(query)}
            >
              <Avatar
                placeholder={profile.name}
                className="size-8 group-hover/result:no-underline"
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

              <div className="flex flex-col font-semibold text-neutral-charcoal group-hover/result:underline">
                <span>{profile.name}</span>
                <span className="text-sm capitalize text-neutral-gray4">
                  {subtitle}
                </span>
              </div>
            </Link>
          </SearchResultItem>
        );
      })}
    </div>
  );
};
