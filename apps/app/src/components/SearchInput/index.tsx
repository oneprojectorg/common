import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { useLocalStorage } from '@/utils/useLocalStorage';
import { trpc } from '@op/api/client';
import { EntityType } from '@op/api/encoders';
import { useDebounce } from '@op/hooks';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { TextField } from '@op/ui/TextField';
import { cn } from '@op/ui/utils';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { LuSearch } from 'react-icons/lu';

import { Link, useRouter } from '@/lib/i18n';

import { ProfileResults } from './ProfileResults';
import { RecentSearches } from './RecentSearches';
import { SearchResultItem } from './SearchResultItem';

export const SearchInput = ({ onBlur }: { onBlur?: () => void } = {}) => {
  const router = useRouter();
  const t = useTranslations();
  const individualSearchEnabled = useFeatureFlag('individual_search');

  const [query, setQuery] = useState<string>('');
  const [debouncedQuery, setImmediateQuery] = useDebounce(query, 200);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [showResults, setShowResults] = useState<boolean>(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [isMobile, setIsMobile] = useState(false);

  // Check if we're on mobile using the same breakpoint as the header
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640); // sm breakpoint
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const { data: profileResults, isFetching: isSearching } =
    trpc.profile.search.useQuery(
      {
        q: debouncedQuery,
        types: individualSearchEnabled
          ? [EntityType.INDIVIDUAL, EntityType.ORG]
          : [EntityType.ORG],
      },
      {
        staleTime: 30_000,
        gcTime: 30_000,
        // make sure we don't remove results while continuing to type
        placeholderData: (prev) => prev,
        enabled: debouncedQuery.length > 1,
      },
    );

  const mergedProfileResults = profileResults
    ? profileResults
        .flatMap(({ results }) => results)
        .sort((a, b) => b.rank - a.rank)
    : [];

  const [recentSearches, setRecentSearches] = useLocalStorage<Array<string>>(
    'recentSearches',
    [],
  );

  const dropdownShowing = !!(
    showResults &&
    (mergedProfileResults?.length || recentSearches.length)
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setShowResults(false);
        setSelectedIndex(-1);
        onBlur?.();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onBlur]);

  useEffect(() => {
    if (isMobile && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isMobile]);

  useEffect(() => {
    setSelectedIndex(-1);
  }, [mergedProfileResults]);

  const recordSearch = (query: string) => {
    setShowResults(false);
    setImmediateQuery('');
    setQuery('');

    if (query.length && !recentSearches.includes(query)) {
      const recentTrimmed = recentSearches.slice(0, 2);
      setRecentSearches([query, ...recentTrimmed]);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    const isInteractingWithDropdown =
      !showResults || !mergedProfileResults?.length;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();

        if (isInteractingWithDropdown) {
          break;
        }

        setSelectedIndex((prev) =>
          prev < mergedProfileResults.length ? prev + 1 : 0,
        );
        break;
      case 'ArrowUp':
        event.preventDefault();

        if (isInteractingWithDropdown) {
          break;
        }

        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : mergedProfileResults.length - 1,
        );
        break;
      case 'Enter':
        event.preventDefault();

        recordSearch(query);

        if (
          isInteractingWithDropdown &&
          mergedProfileResults &&
          selectedIndex > 0
        ) {
          const selectedProfile = mergedProfileResults[selectedIndex - 1];

          if (selectedProfile) {
            const profilePath =
              selectedProfile.type === EntityType.INDIVIDUAL
                ? `/profile/${selectedProfile.slug}`
                : `/org/${selectedProfile.slug}`;
            router.push(profilePath);
            break;
          }
        }

        router.push(`/search?q=${query}`);
        break;
      case 'Escape':
        event.preventDefault();
        setShowResults(false);
        setSelectedIndex(-1);
        break;
    }
  };

  return (
    <div ref={containerRef} className="group">
      <TextField
        ref={inputRef}
        inputProps={{
          placeholder: t('Search'),
          color: 'muted',
          size: 'small',
          icon: isSearching ? (
            <LoadingSpinner className="text-neutral-gray4 size-4" />
          ) : (
            <LuSearch className="text-neutral-gray4 size-4" />
          ),
          className: cn(
            'placeholder:text-neutral-gray4 active:text-neutral-gray3 bg-transparent focus:bg-white active:bg-white',
            'active:border-inherit', // override TextField input styles that are used everywhere
            dropdownShowing && 'sm:rounded-b-none',
          ),
          onKeyDown: handleKeyDown,
          'aria-expanded': dropdownShowing,
          'aria-haspopup': 'listbox',
          'aria-activedescendant':
            selectedIndex >= 0 ? `search-option-${selectedIndex}` : undefined,
          role: 'combobox',
          'aria-autocomplete': 'list',
        }}
        onChange={(e) => {
          setQuery(e);
          setShowResults(true);
        }}
        onFocus={() => setShowResults(true)}
        onBlur={() => {
          setTimeout(() => {
            setShowResults(false);
            onBlur?.();
          }, 150);
        }}
        value={query}
        className={cn('relative z-20', isMobile ? 'w-full' : 'w-96')}
        aria-label={t('Search')}
      >
        {dropdownShowing ? (
          <div
            className="border-neutral-gray1 group-hover:border-neutral-gray2 absolute top-10 z-10 hidden !max-h-80 w-[--trigger-width] min-w-96 overflow-y-auto rounded-b border border-t-0 bg-white sm:block"
            role="listbox"
            aria-label={t('Search results')}
          >
            <div>
              {query.length > 0 && (
                <SearchResultItem
                  selected={selectedIndex === 0}
                  className={cn(
                    'py-2',
                    mergedProfileResults?.length &&
                      'border-neutral-gray1 border-b',
                  )}
                >
                  <Link
                    className="flex w-full items-center gap-2"
                    href={`/search/?q=${query}`}
                    onClick={() => recordSearch(query)}
                  >
                    <LuSearch className="text-neutral-charcoal size-4" />{' '}
                    {query}
                  </Link>
                </SearchResultItem>
              )}
              {query?.length && mergedProfileResults?.length ? (
                <ProfileResults
                  query={query}
                  profileResults={mergedProfileResults}
                  selectedIndex={selectedIndex}
                  onSearch={recordSearch}
                />
              ) : (
                <RecentSearches
                  recentSearches={recentSearches}
                  selectedIndex={selectedIndex}
                  query={query}
                  onSearch={recordSearch}
                />
              )}
            </div>
          </div>
        ) : null}
      </TextField>

      {/* Mobile full-screen search results */}
      {dropdownShowing && (
        <div
          className="fixed inset-x-0 bottom-0 top-[60px] z-10 block overflow-y-auto bg-white sm:hidden"
          role="listbox"
          aria-label={t('Search results')}
        >
          <div className="p-4 pt-0">
            {false && query.length > 0 && (
              <SearchResultItem
                selected={selectedIndex === 0}
                className={cn(
                  'py-2',
                  mergedProfileResults?.length &&
                    'border-neutral-gray1 border-b',
                )}
              >
                <Link
                  className="flex w-full items-center gap-2"
                  href={`/search/?q=${query}`}
                  onClick={() => recordSearch(query)}
                >
                  <LuSearch className="text-neutral-charcoal size-4" /> {query}
                </Link>
              </SearchResultItem>
            )}

            {query?.length && mergedProfileResults?.length ? (
              <ProfileResults
                query={query}
                profileResults={mergedProfileResults}
                selectedIndex={selectedIndex}
                onSearch={recordSearch}
              />
            ) : (
              <RecentSearches
                recentSearches={recentSearches}
                selectedIndex={selectedIndex}
                query={query}
                onSearch={recordSearch}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};
