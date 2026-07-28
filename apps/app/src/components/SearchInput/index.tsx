import { useCanLinkToProfile } from '@/hooks/useCanLinkToProfile';
import { getPublicUrl } from '@/utils';
import { useLocalStorage } from '@/utils/useLocalStorage';
import { trpc } from '@op/api/client';
import { EntityType, ProfileSearchResult } from '@op/api/encoders';
import { match } from '@op/core';
import { useDebounce } from '@op/hooks';
import { Avatar, AvatarFallback, AvatarImage } from '@op/sense/Avatar';
import {
  CommandGroup,
  CommandItem,
  CommandList,
  CommandPrimitive,
  CommandSeparator,
} from '@op/sense/Command';
import { InputGroup, InputGroupAddon } from '@op/sense/InputGroup';
import { Spinner } from '@op/sense/Spinner';
import { cn } from '@op/sense/lib/utils';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { LuClock, LuSearch } from 'react-icons/lu';

import { getLocaleDirection, useRouter } from '@/lib/i18n';

export const SearchInput = ({ onBlur }: { onBlur?: () => void } = {}) => {
  const router = useRouter();
  const t = useTranslations();
  const [query, setQuery] = useState<string>('');
  const [debouncedQuery, setImmediateQuery] = useDebounce(query, 200);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [showResults, setShowResults] = useState<boolean>(false);
  const [isMobile, setIsMobile] = useState(false);
  const locale = useLocale();
  const localeDirection = getLocaleDirection(locale);
  const canLinkToProfile = useCanLinkToProfile();

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
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
    (query.length > 0 || recentSearches.length)
  );

  const showProfiles = query.length > 0 && mergedProfileResults.length > 0;
  const showRecents = query.length === 0 && recentSearches.length > 0;
  const showEmpty =
    query.length > 0 &&
    debouncedQuery.length > 1 &&
    !isSearching &&
    mergedProfileResults.length === 0;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setShowResults(false);
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

  const recordSearch = (searchQuery: string) => {
    setShowResults(false);
    setImmediateQuery('');
    setQuery('');

    if (searchQuery.length && !recentSearches.includes(searchQuery)) {
      const recentTrimmed = recentSearches.slice(0, 2);
      setRecentSearches([searchQuery, ...recentTrimmed]);
    }
  };

  const handleSearchSelect = () => {
    const term = query;
    recordSearch(term);
    router.push(`/search?q=${term}`);
  };

  const handleProfileSelect = (profile: ProfileSearchResult) => {
    if (!canLinkToProfile) {
      return;
    }
    recordSearch(query);
    router.push(
      profile.type === EntityType.INDIVIDUAL
        ? `/profile/${profile.slug}`
        : `/org/${profile.slug}`,
    );
  };

  const handleRecentSelect = (term: string) => {
    setQuery(term);
    setImmediateQuery(term);
    setShowResults(true);
    inputRef.current?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setShowResults(false);
    }
  };

  const listContent = (
    <CommandList className="max-h-86 overflow-x-hidden overflow-y-auto">
      {query.length > 0 ? (
        <CommandGroup>
          <CommandItem value="search-action" onSelect={handleSearchSelect}>
            <LuSearch className="size-4 text-foreground" />
            <span dir="auto">
              {t.rich('Search for <strong>{query}</strong>', {
                query,
                strong: (chunks) => (
                  <strong className="font-bold">{chunks}</strong>
                ),
              })}
            </span>
          </CommandItem>
        </CommandGroup>
      ) : null}

      {showProfiles ? (
        <>
          <CommandSeparator alwaysRender />
          <CommandGroup>
            {mergedProfileResults.map((profile) => (
              <ProfileCommandItem
                key={profile.id}
                profile={profile}
                query={query}
                onSelect={handleProfileSelect}
              />
            ))}
          </CommandGroup>
        </>
      ) : null}

      {showRecents ? (
        <CommandGroup heading={t('Recent Searches')}>
          {recentSearches.map((recentQuery) => (
            <CommandItem
              key={recentQuery}
              value={`recent-${recentQuery}`}
              onSelect={() => handleRecentSelect(recentQuery)}
            >
              <LuClock className="size-4 text-foreground" />
              <span dir="auto">{recentQuery}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      ) : null}

      {showEmpty ? (
        <>
          <CommandSeparator alwaysRender />
          <div className="py-6 text-center text-sm text-muted-foreground">
            {t('No results')}
          </div>
        </>
      ) : null}
    </CommandList>
  );

  return (
    <CommandPrimitive
      ref={containerRef}
      shouldFilter={false}
      loop
      label={t('Search')}
      className={cn('group relative z-20', isMobile ? 'w-full' : 'w-112')}
    >
      <InputGroup className="active:border-inherit">
        <InputGroupAddon align="inline-start">
          {isSearching ? (
            <Spinner className="size-4 text-muted-foreground" />
          ) : (
            <LuSearch className="size-4 text-muted-foreground" />
          )}
        </InputGroupAddon>
        <CommandPrimitive.Input
          ref={inputRef}
          value={query}
          onValueChange={(value) => {
            setQuery(value);
            setShowResults(true);
          }}
          dir={query.length > 0 ? 'auto' : undefined}
          placeholder={t('Search processes, organizations, opportunities…')}
          onFocus={() => setShowResults(true)}
          onBlur={() => {
            setTimeout(() => {
              setShowResults(false);
              onBlur?.();
            }, 150);
          }}
          onKeyDown={handleKeyDown}
          aria-label={t('Search')}
          className={cn(
            'flex-1 bg-transparent ps-1.5 text-base text-foreground outline-none placeholder:text-muted-foreground',
            '[unicode-bidi:plaintext]',
            localeDirection === 'rtl' && 'pl-4',
          )}
        />
      </InputGroup>

      {dropdownShowing ? (
        isMobile ? (
          <div
            className="fixed inset-x-0 top-[60px] bottom-0 z-10 block overflow-y-auto bg-popover text-base"
            aria-label={t('Search results')}
          >
            <div className="p-4 pt-0">{listContent}</div>
          </div>
        ) : (
          <div
            className="absolute top-12 z-10 w-full rounded border bg-popover text-base shadow"
            aria-label={t('Search results')}
          >
            {listContent}
          </div>
        )
      ) : null}
    </CommandPrimitive>
  );
};

interface ProfileCommandItemProps {
  profile: ProfileSearchResult;
  query: string;
  onSelect: (profile: ProfileSearchResult) => void;
}

const ProfileCommandItem = ({
  profile,
  query,
  onSelect,
}: ProfileCommandItemProps) => {
  const isIndividual = profile.type === EntityType.INDIVIDUAL;
  const profileType = match(profile.type, {
    [EntityType.INDIVIDUAL]: 'Individual',
    [EntityType.ORG]: 'Organization',
    _: 'Profile',
  });

  const additionalInfo = isIndividual ? profile.bio : profile.city;
  const subtitle = additionalInfo
    ? `${profileType} • ${additionalInfo}`
    : profileType;

  const avatarSrc = profile.avatarImage?.name
    ? (getPublicUrl(profile.avatarImage.name) ?? undefined)
    : undefined;

  return (
    <CommandItem
      value={`profile-${profile.id}`}
      onSelect={() => onSelect(profile)}
      className="gap-3 py-2.5"
    >
      <Avatar className="aspect-square size-8 shrink-0">
        {avatarSrc ? (
          <AvatarImage src={avatarSrc} alt={`${profile.name} avatar`} />
        ) : null}
        <AvatarFallback name={profile.name} />
      </Avatar>

      <div className="flex flex-col font-semibold text-foreground">
        {highlightName(profile.name, query)}
        <span dir="auto" className="text-sm text-muted-foreground capitalize">
          {subtitle}
        </span>
      </div>
    </CommandItem>
  );
};

const highlightName = (name: string, query: string) => {
  const nameSegments = name.toLowerCase().split(query);
  const firstPiece = nameSegments[0];

  if (firstPiece === undefined) {
    return <bdi>{name}</bdi>;
  }

  return (
    <bdi>
      <span className="font-normal">{name.slice(0, firstPiece.length)}</span>
      <span className="font-bold">
        {name.slice(firstPiece.length, firstPiece.length + query.length)}
      </span>
      <span className="font-normal">
        {name.slice(firstPiece.length + query.length, name.length)}
      </span>
    </bdi>
  );
};
