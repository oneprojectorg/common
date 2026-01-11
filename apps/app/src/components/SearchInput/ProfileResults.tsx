import { getPublicUrl } from '@/utils';
import { EntityType, ProfileSearchResult } from '@op/api/encoders';
import { match } from '@op/core';
import { Avatar } from '@op/ui/Avatar';
import Image from 'next/image';

import { Link } from '@/lib/i18n';

import { SearchResultItem } from './SearchResultItem';

interface ProfileResultsProps {
  query: string;
  profileResults: Array<ProfileSearchResult>;
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
    <div>
      {profileResults.map((profile, index) => {
        // Set up the subtitle that appears in search results
        const isIndividual = profile.type === EntityType.INDIVIDUAL;
        const profileType = match(profile.type, {
          [EntityType.INDIVIDUAL]: 'Individual',
          [EntityType.ORG]: 'Organization',
          _: 'Profile',
        });

        let additionalInfo: string | null;
        if (isIndividual) {
          additionalInfo = profile.bio;
        } else {
          additionalInfo = profile.city;
        }

        const subtitle = additionalInfo
          ? `${profileType} • ${additionalInfo}`
          : profileType;

        // Name styling

        const nameSegments = profile.name.toLowerCase().split(query);
        const firstPiece = nameSegments[0];

        const styledName =
          firstPiece !== undefined ? (
            <span>
              <span className="font-normal">
                {profile.name.slice(0, firstPiece.length)}
              </span>
              <span className="font-bold">
                {profile.name.slice(
                  firstPiece.length,
                  firstPiece.length + query.length,
                )}
              </span>
              <span className="font-normal">
                {profile.name.slice(
                  firstPiece.length + query.length,
                  profile.name.length,
                )}
              </span>
            </span>
          ) : (
            <span>{profile.name}</span>
          );

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
                className="aspect-square size-8 shrink-0 group-hover/result:no-underline"
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

              <div className="text-neutral-charcoal flex flex-col font-semibold group-hover/result:underline">
                {styledName}
                <span className="text-neutral-gray4 text-sm capitalize">
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
