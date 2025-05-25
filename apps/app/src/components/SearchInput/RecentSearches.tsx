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
  if (recentSearches.length === 0 || query.length > 0) {
    return null;
  }

  return (
    <>
      <SearchResultItem className="border-t py-2 pt-6 text-neutral-gray4">
        Recent Searches
      </SearchResultItem>
      {recentSearches.map((recentQuery, index) => (
        <SearchResultItem
          key={recentQuery}
          selected={selectedIndex === index + (query.length ? 1 : 0)}
          className="py-2"
        >
          <Link
            className="flex w-full items-center gap-2"
            href={`/search/?q=${recentQuery}`}
            onClick={() => onSearch(query)}
          >
            <LuClock className="size-4 text-neutral-charcoal" /> {recentQuery}
          </Link>
        </SearchResultItem>
      ))}
    </>
  );
};
