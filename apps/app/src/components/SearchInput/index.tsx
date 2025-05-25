import { useLocalStorage } from '@/utils/useLocalStorage';
import { trpc } from '@op/api/client';
import { TextField } from '@op/ui/TextField';
import { cn } from '@op/ui/utils';
import { useEffect, useRef, useState } from 'react';
import { LuClock, LuSearch } from 'react-icons/lu';
import { useDebounce } from 'use-debounce';

import { Link, useRouter } from '@/lib/i18n';

import { OrganizationAvatar } from '../OrganizationAvatar';

const SearchResultItem = ({
  children,
  selected,
  className,
}: {
  children: React.ReactNode;
  selected: boolean;
  className?: string;
}) => {
  return (
    <div
      role="option"
      aria-selected={selected}
      className={cn(
        'group flex cursor-pointer select-none items-center gap-2 p-4',
        selected ? 'bg-neutral-offWhite' : 'hover:bg-neutral-offWhite',
        className,
      )}
    >
      {children}
    </div>
  );
};

export const SearchInput = () => {
  const router = useRouter();

  const [query, setQuery] = useState<string>('');
  const [debouncedQuery, setImmediateQuery] = useDebounce(query, 200);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showResults, setShowResults] = useState<boolean>(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
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
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    setSelectedIndex(-1);
  }, [organizationResults]);

  const recordSearch = (query: string) => {
    setShowResults(false);
    setImmediateQuery('');
    setQuery('');

    if (query.length && !recentSearches.includes(query)) {
      const recentTrimmed = recentSearches.slice(0, 2);
      setRecentSearches([...recentTrimmed, query]);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    const isInteractingwWithDropdown =
      !dropdownShowing || !organizationResults?.length;

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

        router.push(`/org?q=${query}`);
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
        inputProps={{
          placeholder: 'Search',
          color: 'muted',
          size: 'small',
          icon: <LuSearch className="size-4 text-neutral-gray4" />,
          className: cn(
            'active:bg-white active:text-neutral-gray3 focus:bg-white',
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
        value={query}
        className="relative z-20 w-96"
        aria-label="Search"
      >
        {dropdownShowing ? (
          <div
            className="absolute top-10 z-10 !max-h-80 w-[--trigger-width] min-w-96 overflow-y-auto rounded-b border border-t-0 bg-white pb-4 group-hover:border-neutral-gray2"
            role="listbox"
            aria-label="Search results"
          >
            <div className="space-y-1">
              {query.length > 0 && (
                <SearchResultItem
                  selected={selectedIndex === 0}
                  className="border-b py-2"
                >
                  <Link
                    className="flex w-full items-center gap-2"
                    href={`/org/?q=${query}`}
                    onClick={() => recordSearch(query)}
                  >
                    <LuSearch className="size-4 text-neutral-charcoal" />{' '}
                    {query}
                  </Link>
                </SearchResultItem>
              )}

              {organizationResults?.length
                ? organizationResults.map((org, index) => (
                    <SearchResultItem
                      key={org.id}
                      selected={selectedIndex === index + 1}
                    >
                      <Link
                        className="flex w-full items-center gap-4"
                        href={`/org/${org.slug}`}
                        onClick={() => recordSearch(query)}
                      >
                        <OrganizationAvatar
                          organization={org}
                          className="size-8"
                        />

                        <div className="flex flex-col text-sm">
                          <span>{org.name}</span>
                          <span>{org.city}</span>
                        </div>
                      </Link>
                    </SearchResultItem>
                  ))
                : recentSearches.length > 0 &&
                  !query.length &&
                  recentSearches.map((recentQuery, index) => (
                    <SearchResultItem
                      key={recentQuery}
                      selected={
                        selectedIndex === index + (query.length ? 1 : 0)
                      }
                      className="py-2"
                    >
                      <Link
                        className="flex w-full items-center gap-2"
                        href={`/org/?q=${recentQuery}`}
                        onClick={() => recordSearch(query)}
                      >
                        <LuClock className="size-4 text-neutral-charcoal" />{' '}
                        {recentQuery}
                      </Link>
                    </SearchResultItem>
                  ))}
            </div>
          </div>
        ) : null}
      </TextField>
    </div>
  );
};
