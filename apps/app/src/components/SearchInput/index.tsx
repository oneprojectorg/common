import { useLocalStorage } from '@/utils/useLocalStorage';
import { trpc } from '@op/api/client';
import { TextField } from '@op/ui/TextField';
import { cn } from '@op/ui/utils';
import { useEffect, useRef, useState } from 'react';
import { LuSearch } from 'react-icons/lu';
import { useDebounce } from 'use-debounce';

import { Link, useRouter } from '@/lib/i18n';

import { OrganizationResults } from './OrganizationResults';
import { RecentSearches } from './RecentSearches';
import { SearchResultItem } from './SearchResultItem';

export const SearchInput = ({ onBlur }: { onBlur?: () => void } = {}) => {
  const router = useRouter();

  const [query, setQuery] = useState<string>('');
  const [debouncedQuery, setImmediateQuery] = useDebounce(query, 200);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [showResults, setShowResults] = useState<boolean>(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [isMobile, setIsMobile] = useState(false);
  const { data: organizationResults } = trpc.organization.search.useQuery({
    q: debouncedQuery,
  });
  const [recentSearches, setRecentSearches] = useLocalStorage<Array<string>>(
    'recentSearches',
    [],
  );

  const dropdownShowing = !!(
    showResults &&
    (organizationResults?.length || recentSearches.length)
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
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (isMobile && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isMobile]);

  useEffect(() => {
    setSelectedIndex(-1);
  }, [organizationResults]);

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
    const isInteractingwWithDropdown =
      !showResults || !organizationResults?.length;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();

        if (isInteractingwWithDropdown) {
          break;
        }

        setSelectedIndex((prev) =>
          prev < organizationResults.length ? prev + 1 : 0,
        );
        break;
      case 'ArrowUp':
        event.preventDefault();

        if (isInteractingwWithDropdown) {
          break;
        }

        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : organizationResults.length - 1,
        );
        break;
      case 'Enter':
        event.preventDefault();

        recordSearch(query);

        if (
          isInteractingwWithDropdown &&
          organizationResults &&
          selectedIndex > 0
        ) {
          const selectedOrg = organizationResults[selectedIndex - 1];

          if (selectedOrg) {
            router.push(`/org/${selectedOrg.slug}`);
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
          icon: <LuSearch className="size-4 text-neutral-gray4" />,
          className: cn(
            'bg-transparent placeholder:text-neutral-gray4 active:bg-white active:text-neutral-gray3 focus:bg-white',
            'active:border-inherit', // override TextField input styles that are used everywhere
            dropdownShowing && 'rounded-b-none',
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
        className={cn("relative z-20", isMobile ? "w-full" : "w-96")}
        aria-label="Search"
      >
        {dropdownShowing ? (
          <div
            className={cn(
              "absolute z-10 overflow-y-auto bg-white",
              isMobile 
                ? "fixed inset-x-0 top-[60px] bottom-0 border-t" 
                : "top-10 !max-h-80 w-[--trigger-width] min-w-96 rounded-b border border-t-0 group-hover:border-neutral-gray2"
            )}
            role="listbox"
            aria-label="Search results"
          >
            <div className={cn(isMobile ? "p-4" : "")}>
              {query.length > 0 && (
                <SearchResultItem
                  selected={selectedIndex === 0}
                  className={cn(
                    'py-2',
                    organizationResults?.length && 'border-b',
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
              {query?.length && organizationResults?.length ? (
                <OrganizationResults
                  query={query}
                  organizationResults={organizationResults}
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
    </div>
  );
};
