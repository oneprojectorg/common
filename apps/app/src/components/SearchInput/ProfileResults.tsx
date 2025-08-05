import { getPublicUrl } from '@/utils';
import { EntityType, Profile } from '@op/api/encoders';
import { Avatar } from '@op/ui/Avatar';
import Image from 'next/image';

import { Link, useTranslations } from '@/lib/i18n';

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
  const t = useTranslations();
  
  return (
    <div className="pb-4">
      {profileResults.map((profile, index) => (
        <SearchResultItem
          key={profile.id}
          selected={selectedIndex === index + 1}
        >
          <Link
            className="group/result flex w-full items-center gap-4 hover:no-underline"
            href={
              profile.type === EntityType.INDIVIDUAL
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
                  alt={`${profile.name} ${t('avatar')}`}
                  fill
                  className="object-cover"
                />
              ) : null}
            </Avatar>

            <div className="flex flex-col font-semibold text-neutral-charcoal group-hover/result:underline">
              <span>{profile.name}</span>
              <span className="text-sm capitalize text-neutral-gray4">
                {profile.type === EntityType.INDIVIDUAL
                  ? t('Individual')
                  : t('Organization')}
                {profile.city && ` • ${profile.city}`}
              </span>
            </div>
          </Link>
        </SearchResultItem>
      ))}
    </div>
  );
};
