import { trpc } from '@op/api/client';
import { TextField } from '@op/ui/TextField';
import { cn } from '@op/ui/utils';
import { useEffect, useRef, useState } from 'react';
import { LuSearch } from 'react-icons/lu';
import { useDebounce } from 'use-debounce';

import { Link, useRouter } from '@/lib/i18n';

import { OrganizationAvatar } from '../OrganizationAvatar';

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

  const dropdownShowing = !!(showResults && organizationResults?.length);

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

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!dropdownShowing) {
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setSelectedIndex((prev) =>
          prev < organizationResults.length - 1 ? prev + 1 : 0,
        );
        break;
      case 'ArrowUp':
        event.preventDefault();
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : organizationResults.length - 1,
        );
        break;
      case 'Enter':
        event.preventDefault();
        if (selectedIndex >= 0) {
          const selectedOrg = organizationResults[selectedIndex];
          if (selectedOrg) {
            setImmediateQuery('');
            setQuery('');
            router.push(`/org/${selectedOrg.slug}`);
          }
        }
        break;
      case 'Escape':
        event.preventDefault();
        setShowResults(false);
        setSelectedIndex(-1);
        break;
    }
  };

  return (
    <div ref={containerRef}>
      <TextField
        inputProps={{
          placeholder: 'Search',
          color: 'muted',
          size: 'small',
          icon: <LuSearch className="size-4 text-neutral-gray4" />,
          className: cn(
            'active:bg-white focus:bg-white',
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
            className="absolute top-10 z-10 !max-h-60 w-[--trigger-width] min-w-96 overflow-y-auto rounded-b border border-t-0 bg-white"
            role="listbox"
            aria-label="Search results"
          >
            <div className="space-y-1">
              {organizationResults.map((org, index) => (
                <div
                  key={org.id}
                  id={`search-option-${index}`}
                  role="option"
                  aria-selected={selectedIndex === index}
                  className={`group flex cursor-pointer select-none items-center gap-2 py-2 pl-2 pr-4 ${
                    selectedIndex === index
                      ? 'bg-neutral-offWhite'
                      : 'hover:bg-neutral-offWhite'
                  }`}
                >
                  <Link
                    className="flex w-full items-center gap-4"
                    href={`/org/${org.slug}`}
                    onClick={() => setShowResults(false)}
                  >
                    <OrganizationAvatar organization={org} className="size-8" />

                    <div className="flex flex-col text-sm">
                      <span>{org.name}</span>
                      <span>{org.city}</span>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </TextField>
    </div>
  );
};
