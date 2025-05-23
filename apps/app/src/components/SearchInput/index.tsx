import { trpc } from '@op/api/client';
import { ListBox, ListBoxItem } from '@op/ui/ListBox';
import { TextField } from '@op/ui/TextField';
import { useEffect, useRef, useState } from 'react';
import { LuSearch } from 'react-icons/lu';
import { useDebounce } from 'use-debounce';

import { Link } from '@/lib/i18n';

import { OrganizationAvatar } from '../OrganizationAvatar';

export const SearchInput = () => {
  const [query, setQuery] = useState<string>('');
  const containerRef = useRef<HTMLDivElement>(null);
  const [showResults, setShowResults] = useState<boolean>(false);
  const [debouncedQuery] = useDebounce(query, 200);
  const { data: organizationResults } = trpc.organization.search.useQuery({
    q: debouncedQuery,
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div ref={containerRef}>
      <TextField
        inputProps={{
          placeholder: 'Search',
          color: 'muted',
          size: 'small',
          icon: <LuSearch className="size-4 text-neutral-gray4" />,
          className: 'active:bg-neutral-offWhite focus:bg-neutral-offWhite',
        }}
        onChange={(e) => {
          setQuery(e);
          setShowResults(true);
        }}
        onFocus={() => setShowResults(true)}
        value={query}
        className="w-96"
        aria-label="Search"
      >
        {showResults && organizationResults?.length ? (
          <div className="absolute top-12 z-10 !max-h-60 w-[--trigger-width] min-w-96 rounded-b border-b border-l border-r bg-neutral-offWhite p-2 shadow">
            <ListBox items={organizationResults} className="border-0">
              {(org) => (
                <ListBoxItem
                  id={org.id}
                  className="group flex cursor-pointer select-none items-center gap-2 py-2 pl-2 pr-4"
                >
                  <Link
                    className="flex items-center gap-4"
                    href={`/org/${org.slug}`}
                    onClick={() => setShowResults(false)}
                  >
                    <OrganizationAvatar organization={org} className="size-8" />

                    <div className="flex flex-col text-sm">
                      <span>{org.name}</span>
                      <span>{org.city}</span>
                    </div>
                  </Link>
                </ListBoxItem>
              )}
            </ListBox>
          </div>
        ) : null}
      </TextField>
    </div>
  );
};
