import { useTranslations } from 'next-intl';
import { LuClock } from 'react-icons/lu';

import { Link } from '@/lib/i18n';

import { SearchResultItem } from './SearchResultItem';

interface RecentSearchesProps {
  recentSearches: string[];
  selectedIndex: number;
  query: string;
  onSearch: (query: string) => void;
}

export const RecentSearches = ({
  recentSearches,
  selectedIndex,
  query,
  onSearch,
}: RecentSearchesProps) => {
  const t = useTranslations();
  if (recentSearches.length === 0 || query.length > 0) {
    return null;
  }

  return (
    <div className="pb-4">
      <SearchResultItem className="py-2 pt-6 text-neutral-gray4 hover:bg-transparent">
        {t('Recent Searches')}
      </SearchResultItem>
      {recentSearches.map((recentQuery, index) => (
        <SearchResultItem
          key={recentQuery}
          selected={selectedIndex === index + (query.length ? 1 : 0)}
          className="py-2"
        >
          <Link
            className="gap-2 flex w-full items-center"
            href={`/search/?q=${recentQuery}`}
            onClick={() => onSearch(query)}
          >
            <LuClock className="size-4 text-neutral-charcoal" /> {recentQuery}
          </Link>
        </SearchResultItem>
      ))}
    </div>
  );
};
