import { useLocalStorage } from '@/utils/useLocalStorage';
import { trpc } from '@op/api/client';
import { EntityType } from '@op/api/encoders';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { TextField } from '@op/ui/TextField';
import { cn } from '@op/ui/utils';
import { useFeatureFlagEnabled } from 'posthog-js/react';
import { useEffect, useRef, useState } from 'react';
import { LuSearch } from 'react-icons/lu';
import { useDebounce } from 'use-debounce';

import { Link, useRouter } from '@/lib/i18n';

import { ProfileResults } from './ProfileResults';
import { RecentSearches } from './RecentSearches';
import { SearchResultItem } from './SearchResultItem';

export const SearchInput = ({ onBlur }: { onBlur?: () => void } = {}) => {
  const router = useRouter();
  const individualProfilesEnabled = useFeatureFlagEnabled(
    'individual_profiles',
  );

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
        types: individualProfilesEnabled
          ? [EntityType.USER, EntityType.ORG]
          : [EntityType.ORG],
      },
      {
        staleTime: 30_000,
        // make sure we don't remove results while continuing to type
        placeholderData: (prev) => prev,
      },
    );
  const [recentSearches, setRecentSearches] = useLocalStorage<Array<string>>(
    'recentSearches',
    [],
  );

  const dropdownShowing = !!(
    showResults &&
    (profileResults?.length || recentSearches.length)
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
  }, [profileResults]);

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
    const isInteractingwWithDropdown = !showResults || !profileResults?.length;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();

        if (isInteractingwWithDropdown) {
          break;
        }

        setSelectedIndex((prev) =>
          prev < profileResults.length ? prev + 1 : 0,
        );
        break;
      case 'ArrowUp':
        event.preventDefault();

        if (isInteractingwWithDropdown) {
          break;
        }

        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : profileResults.length - 1,
        );
        break;
      case 'Enter':
        event.preventDefault();

        recordSearch(query);

        if (isInteractingwWithDropdown && profileResults && selectedIndex > 0) {
          const selectedProfile = profileResults[selectedIndex - 1];

          if (selectedProfile) {
            const profilePath =
              selectedProfile.type === 'user'
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
          placeholder: 'Search',
          color: 'muted',
          size: 'small',
          icon: isSearching ? (
            <LoadingSpinner className="size-4 text-neutral-gray4" />
          ) : (
            <LuSearch className="size-4 text-neutral-gray4" />
          ),
          className: cn(
            'bg-transparent placeholder:text-neutral-gray4 active:bg-white active:text-neutral-gray3 focus:bg-white',
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
        aria-label="Search"
      >
        {dropdownShowing ? (
          <div
            className="absolute top-10 z-10 hidden !max-h-80 w-[--trigger-width] min-w-96 overflow-y-auto rounded-b border border-t-0 bg-white group-hover:border-neutral-gray2 sm:block"
            role="listbox"
            aria-label="Search results"
          >
            <div>
              {query.length > 0 && (
                <SearchResultItem
                  selected={selectedIndex === 0}
                  className={cn('py-2', profileResults?.length && 'border-b')}
                >
                  <Link
                    className="flex w-full items-center gap-2"
                    href={`/search/?q=${query}`}
                    onClick={() => recordSearch(query)}
                  >
                    <LuSearch className="size-4 text-neutral-charcoal" />{' '}
                    {query}
                  </Link>
                </SearchResultItem>
              )}
              {query?.length && profileResults?.length ? (
                <ProfileResults
                  query={query}
                  profileResults={profileResults}
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
          aria-label="Search results"
        >
          <div className="p-4 pt-0">
            {false && query.length > 0 && (
              <SearchResultItem
                selected={selectedIndex === 0}
                className={cn('py-2', profileResults?.length && 'border-b')}
              >
                <Link
                  className="flex w-full items-center gap-2"
                  href={`/search/?q=${query}`}
                  onClick={() => recordSearch(query)}
                >
                  <LuSearch className="size-4 text-neutral-charcoal" /> {query}
                </Link>
              </SearchResultItem>
            )}
            {query?.length && profileResults?.length ? (
              <ProfileResults
                query={query}
                profileResults={profileResults}
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
