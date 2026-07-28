import { useLocalStorage } from '@/utils/useLocalStorage';
import { trpc } from '@op/api/client';
import { EntityType } from '@op/api/encoders';
import { useDebounce } from '@op/hooks';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@op/sense/InputGroup';
import { Spinner } from '@op/sense/Spinner';
import { cn } from '@op/sense/lib/utils';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { LuSearch } from 'react-icons/lu';

import { getLocaleDirection, Link, useRouter } from '@/lib/i18n';

import { ProfileResults } from './ProfileResults';
import { RecentSearches } from './RecentSearches';
import { SearchResultItem } from './SearchResultItem';

export const SearchInput = ({ onBlur }: { onBlur?: () => void } = {}) => {
  const router = useRouter();
  const t = useTranslations();
  const [query, setQuery] = useState<string>('');
  const [debouncedQuery, setImmediateQuery] = useDebounce(query, 200);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [showResults, setShowResults] = useState<boolean>(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [isMobile, setIsMobile] = useState(false);
  const locale = useLocale();
  const localeDirection = getLocaleDirection(locale);

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
        types: [EntityType.INDIVIDUAL, EntityType.ORG],
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
      <div className={cn('relative z-20', isMobile ? 'w-full' : 'w-96')}>
        <InputGroup
          className={cn(
            'bg-transparent focus-within:bg-white active:bg-white',
            'active:border-inherit', // override input styles that are used everywhere
            dropdownShowing && 'sm:rounded-b-none',
          )}
        >
          <InputGroupAddon align="inline-start">
            {isSearching ? (
              <Spinner className="size-4 text-neutral-gray4" />
            ) : (
              <LuSearch className="size-4 text-neutral-gray4" />
            )}
          </InputGroupAddon>
          <InputGroupInput
            ref={inputRef}
            dir={query.length > 0 ? 'auto' : undefined}
            placeholder={t('Search')}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowResults(true);
            }}
            onFocus={() => setShowResults(true)}
            onBlur={() => {
              setTimeout(() => {
                setShowResults(false);
                onBlur?.();
              }, 150);
            }}
            onKeyDown={handleKeyDown}
            aria-label={t('Search')}
            aria-expanded={dropdownShowing}
            aria-haspopup="listbox"
            aria-activedescendant={
              selectedIndex >= 0 ? `search-option-${selectedIndex}` : undefined
            }
            role="combobox"
            aria-autocomplete="list"
            className={cn(
              'bg-transparent placeholder:text-neutral-gray4 active:text-neutral-gray3',
              '[unicode-bidi:plaintext]',
              localeDirection === 'rtl' && 'pl-4',
            )}
          />
        </InputGroup>

        {dropdownShowing ? (
          <div
            className="absolute top-10 z-10 hidden !max-h-80 w-(--trigger-width) min-w-96 overflow-y-auto rounded-b border border-t-0 bg-white text-base group-hover:border-neutral-gray2 sm:block"
            role="listbox"
            aria-label={t('Search results')}
          >
            <div>
              {query.length > 0 && (
                <SearchResultItem
                  selected={selectedIndex === 0}
                  className={cn(
                    'py-2',
                    mergedProfileResults?.length && 'border-b',
                  )}
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
      </div>

      {/* Mobile full-screen search results */}
      {dropdownShowing && (
        <div
          className="fixed inset-x-0 top-[60px] bottom-0 z-10 block overflow-y-auto bg-white text-base sm:hidden"
          role="listbox"
          aria-label={t('Search results')}
        >
          <div className="p-4 pt-0">
            {false && query.length > 0 && (
              <SearchResultItem
                selected={selectedIndex === 0}
                className={cn(
                  'py-2',
                  mergedProfileResults?.length && 'border-b',
                )}
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
