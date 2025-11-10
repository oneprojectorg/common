import { trpc } from '@op/api/client';
import { EntityType, ProfileSearchResult } from '@op/api/encoders';
import { Button } from '@op/ui/Button';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { TextField } from '@op/ui/TextField';
import { cn } from '@op/ui/utils';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { LuPlus, LuSearch } from 'react-icons/lu';
import { useDebounce } from 'use-debounce';

import { ProfileResults } from './ProfileResults';
import { SelectedChip } from './SelectedChip';

interface SelectableSearchInputProps {
  onSelectionChange?: (selected: ProfileSearchResult[]) => void;
  initialSelections?: ProfileSearchResult[];
  maxSelections?: number;
  placeholder?: string;
  className?: string;
}

export const SelectableSearchInput = ({
  onSelectionChange,
  initialSelections = [],
  maxSelections,
  placeholder,
  className,
}: SelectableSearchInputProps) => {
  const t = useTranslations();

  const [query, setQuery] = useState<string>('');
  const [debouncedQuery] = useDebounce(query, 200);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showResults, setShowResults] = useState<boolean>(false);
  const [selectedProfiles, setSelectedProfiles] =
    useState<ProfileSearchResult[]>(initialSelections);

  const { data: profileResults, isFetching: isSearching } =
    trpc.profile.search.useQuery(
      {
        q: debouncedQuery,
        types: [EntityType.ORG],
      },
      {
        staleTime: 30_000,
        gcTime: 30_000,
        placeholderData: (prev) => prev,
      },
    );

  const mergedProfileResults = profileResults
    ? profileResults
        .flatMap(({ results }) => results)
        .sort((a, b) => Number(b.rank) - Number(a.rank))
        .filter((profile) => !selectedProfiles.some((s) => s.id === profile.id))
    : [];

  const dropdownShowing =
    showResults && (query.length > 1 || mergedProfileResults.length > 0);

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

  // Notify parent of selection changes
  useEffect(() => {
    onSelectionChange?.(selectedProfiles);
  }, [selectedProfiles, onSelectionChange]);

  // Notify parent of initial selections
  useEffect(() => {
    if (initialSelections.length > 0) {
      onSelectionChange?.(initialSelections);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelect = (profile: ProfileSearchResult) => {
    if (maxSelections && selectedProfiles.length >= maxSelections) {
      return;
    }

    setSelectedProfiles((prev) => [...prev, profile]);

    // setQuery('');
    // setShowResults(false);
  };

  const handleRemove = (profile: ProfileSearchResult) => {
    setSelectedProfiles((prev) => prev.filter((p) => p.id !== profile.id));
  };

  return (
    <div ref={containerRef} className={cn('flex flex-col gap-4', className)}>
      <div className={cn('relative', dropdownShowing && 'h-10')}>
        <div
          className={cn(
            'w-full overflow-hidden rounded',
            dropdownShowing && 'absolute shadow-md',
          )}
        >
          <TextField
            inputProps={{
              placeholder: placeholder ?? t('Search'),
              color: 'muted',
              size: 'small',
              icon: isSearching ? (
                <LoadingSpinner className="size-4 text-neutral-gray4" />
              ) : (
                <LuSearch className="size-4 text-neutral-gray4" />
              ),
              className: cn(
                'bg-white placeholder:text-neutral-gray4',
                dropdownShowing && 'rounded-b-none',
              ),
            }}
            onChange={(e) => {
              setQuery(e);
              setShowResults(true);
            }}
            onFocus={() => setShowResults(true)}
            value={query}
            className="relative z-20 flex"
            aria-label={t('Search')}
          />
          {dropdownShowing ? (
            <div
              className="relative z-10 !max-h-80 w-full overflow-y-auto rounded-b border border-t-0 bg-white"
              role="listbox"
              aria-label={t('Search results')}
            >
              <ProfileResults
                query={query}
                profileResults={mergedProfileResults}
                selectedIndex={-1}
                onSearch={() => {}}
                selectable
                onSelect={handleSelect}
              />
              {query.length > 1 && (
                <div>
                  <Button
                    surface="ghost"
                    className="w-full justify-start text-primary shadow-none pressed:bg-offWhite pressed:text-primary-tealBlack pressed:shadow-none"
                  >
                    <LuPlus />
                    Add <span className="font-semibold">{query}</span>
                  </Button>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {selectedProfiles.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedProfiles.map((profile) => (
            <SelectedChip
              key={profile.id}
              profile={profile}
              onRemove={handleRemove}
            />
          ))}
        </div>
      )}
    </div>
  );
};
