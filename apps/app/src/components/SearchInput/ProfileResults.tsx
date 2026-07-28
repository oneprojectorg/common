import { useCanLinkToProfile } from '@/hooks/useCanLinkToProfile';
import { getPublicUrl } from '@/utils';
import { EntityType, ProfileSearchResult } from '@op/api/encoders';
import { match } from '@op/core';
import { Avatar, AvatarFallback, AvatarImage } from '@op/sense/Avatar';

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
  const canLinkToProfile = useCanLinkToProfile();
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
            <bdi>
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
            </bdi>
          ) : (
            <bdi>{profile.name}</bdi>
          );

        const avatarSrc = profile.avatarImage?.name
          ? (getPublicUrl(profile.avatarImage.name) ?? undefined)
          : undefined;

        const resultInner = (
          <>
            <Avatar className="aspect-square size-8 shrink-0 group-hover/result:no-underline">
              {avatarSrc ? (
                <AvatarImage src={avatarSrc} alt={`${profile.name} avatar`} />
              ) : null}
              <AvatarFallback name={profile.name} />
            </Avatar>

            <div className="flex flex-col font-semibold text-neutral-charcoal group-hover/result:underline">
              {styledName}
              <span
                dir="auto"
                className="text-sm text-neutral-gray4 capitalize"
              >
                {subtitle}
              </span>
            </div>
          </>
        );

        return (
          <SearchResultItem
            key={profile.id}
            selected={selectedIndex === index + 1}
          >
            {/* Public/non-member viewers can't reach the profile page. */}
            {canLinkToProfile ? (
              <Link
                className="group/result flex w-full items-center gap-4 hover:no-underline"
                href={
                  isIndividual
                    ? `/profile/${profile.slug}`
                    : `/org/${profile.slug}`
                }
                onClick={() => onSearch(query)}
              >
                {resultInner}
              </Link>
            ) : (
              <div className="group/result flex w-full items-center gap-4">
                {resultInner}
              </div>
            )}
          </SearchResultItem>
        );
      })}
    </div>
  );
};
