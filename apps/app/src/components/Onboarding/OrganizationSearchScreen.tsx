'use client';

import { RouterOutput, trpc } from '@op/api/client';
import { useDebounce } from '@op/hooks';
import { Button } from '@op/ui/Button';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { TextField } from '@op/ui/TextField';
import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { LuPlus, LuSearch, LuX } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { OrganizationAvatar } from '../OrganizationAvatar';
import { FormContainer } from '../form/FormContainer';
import { FormHeader } from '../form/FormHeader';
import { ToSAcceptanceScreen } from './ToSAcceptanceScreen';

type SearchOrganization = RouterOutput['organization']['search'][number];

export type OrganizationSearchScreenProps = {
  onContinue: (selectedOrgs: Array<{ id: string; profileId: string }>) => void;
  onAddOrganization?: (searchTerm: string) => void;
  isSubmitting?: boolean;
};

export const OrganizationSearchScreen = ({
  onContinue,
  onAddOrganization,
  isSubmitting,
}: OrganizationSearchScreenProps): ReactNode => {
  const t = useTranslations();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery] = useDebounce(searchQuery, 300);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedOrgs, setSelectedOrgs] = useState<SearchOrganization[]>([]);
  const [showToS, setShowToS] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: searchResults, isFetching } = trpc.organization.search.useQuery(
    { q: debouncedQuery },
    {
      enabled: debouncedQuery.length >= 2,
      staleTime: 30_000,
      placeholderData: (prev) => prev,
    },
  );

  // Show dropdown when we have a query
  useEffect(() => {
    if (debouncedQuery.length >= 2) {
      setIsDropdownOpen(true);
    } else {
      setIsDropdownOpen(false);
    }
  }, [debouncedQuery]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectOrg = useCallback((org: SearchOrganization) => {
    setSelectedOrgs((prev) => {
      if (prev.some((o) => o.id === org.id)) {
        return prev;
      }
      return [...prev, org];
    });
    setSearchQuery('');
    setIsDropdownOpen(false);
  }, []);

  const handleRemoveOrg = useCallback((orgId: string) => {
    setSelectedOrgs((prev) => prev.filter((o) => o.id !== orgId));
  }, []);

  const handleContinueToToS = useCallback(() => {
    setShowToS(true);
  }, []);

  const handleSkipToToS = useCallback(() => {
    setShowToS(true);
  }, []);

  const handleAcceptToS = useCallback(() => {
    onContinue(
      selectedOrgs.flatMap((org) => {
        const profileId = org.profile?.id;
        if (!profileId) {
          return [];
        }
        return [{ id: org.id, profileId }];
      }),
    );
  }, [selectedOrgs, onContinue]);

  const handleGoBack = useCallback(() => {
    setShowToS(false);
  }, []);

  const hasSelectedOrgs = selectedOrgs.length > 0;

  const getOrgLocation = (org: SearchOrganization): string => {
    if (org.profile?.city && org.profile?.state) {
      return `${org.profile.city}, ${org.profile.state}`;
    }
    if (org.profile?.city) {
      return org.profile.city;
    }
    if (org.profile?.state) {
      return org.profile.state;
    }
    if (org.whereWeWork.length > 0) {
      return org.whereWeWork
        .map((loc) => loc.name)
        .filter(Boolean)
        .join(', ');
    }
    return '';
  };

  const highlightMatch = (text: string, query: string): ReactNode => {
    if (!query) {
      return text;
    }
    const index = text.toLowerCase().indexOf(query.toLowerCase());
    if (index === -1) {
      return text;
    }
    return (
      <>
        {text.slice(0, index)}
        <strong className="font-semibold">
          {text.slice(index, index + query.length)}
        </strong>
        {text.slice(index + query.length)}
      </>
    );
  };

  if (showToS) {
    return (
      <ToSAcceptanceScreen
        onAccept={handleAcceptToS}
        onGoBack={handleGoBack}
        isSubmitting={isSubmitting}
      />
    );
  }

  return (
    <div className="flex w-full max-w-lg flex-col items-center">
      <FormContainer>
        <FormHeader text={t('Find organizations you belong to')}>
          {t(
            'Select the organization(s) you want to link to your Common profile. You can add more later from your profile.',
          )}
        </FormHeader>

        <div className="flex flex-col gap-6">
          {/* Search input with dropdown */}
          <div ref={containerRef} className="relative">
            <TextField
              value={searchQuery}
              onChange={setSearchQuery}
              inputProps={{
                placeholder: t('Search or add your organization...'),
                icon: <LuSearch className="size-4 text-neutral-gray4" />,
              }}
              aria-label={t('Search or add your organization...')}
            />

            {/* Search results dropdown */}
            {isDropdownOpen && (
              <div
                ref={dropdownRef}
                className="absolute top-full right-0 left-0 z-10 mt-1 max-h-64 overflow-y-auto rounded-lg border border-neutral-gray2 bg-white shadow-lg"
              >
                {isFetching && !searchResults ? (
                  <div className="flex items-center justify-center py-4">
                    <LoadingSpinner />
                  </div>
                ) : (
                  <>
                    {searchResults && searchResults.length > 0 ? (
                      searchResults.map((org) => (
                        <button
                          key={org.id}
                          type="button"
                          className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-neutral-offWhite"
                          onClick={() => handleSelectOrg(org)}
                        >
                          <OrganizationAvatar
                            profile={org.profile}
                            withLink={false}
                            className="size-8"
                          />
                          <div className="flex min-w-0 flex-col">
                            <span className="truncate text-sm text-neutral-charcoal">
                              {highlightMatch(
                                org.profile?.name ?? '',
                                searchQuery,
                              )}
                            </span>
                            {getOrgLocation(org) && (
                              <span className="truncate text-xs text-neutral-gray4">
                                {getOrgLocation(org)}
                              </span>
                            )}
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-sm text-neutral-gray4">
                        {t('No results')}
                      </div>
                    )}

                    {/* Add organization fallback */}
                    {onAddOrganization && searchQuery && (
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 border-t border-neutral-gray2 px-4 py-3 text-left text-primary-teal hover:bg-neutral-offWhite"
                        onClick={() => onAddOrganization(searchQuery)}
                      >
                        <LuPlus className="size-4" />
                        <span className="text-sm">
                          {t('Add {searchTerm}', {
                            searchTerm: searchQuery,
                          })}
                        </span>
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Selected organization chips */}
          {hasSelectedOrgs && (
            <div className="flex flex-wrap gap-2">
              {selectedOrgs.map((org) => (
                <div
                  key={org.id}
                  className="flex items-center gap-2 rounded-full border border-neutral-gray2 bg-white px-3 py-1.5"
                >
                  <OrganizationAvatar
                    profile={org.profile}
                    withLink={false}
                    className="!size-5"
                  />
                  <span className="text-sm text-neutral-charcoal">
                    {org.profile?.name}
                  </span>
                  {getOrgLocation(org) && (
                    <span className="text-xs text-neutral-gray4">
                      {getOrgLocation(org)}
                    </span>
                  )}
                  <button
                    type="button"
                    className="ml-1 rounded-full p-0.5 text-neutral-gray4 hover:bg-neutral-gray1 hover:text-neutral-charcoal"
                    onClick={() => handleRemoveOrg(org.id)}
                    aria-label={t('Remove')}
                  >
                    <LuX className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Continue button when orgs are selected */}
          {hasSelectedOrgs ? (
            <Button className="w-full" onPress={handleContinueToToS}>
              {t('Continue with {count} organizations', {
                count: selectedOrgs.length,
              })}
            </Button>
          ) : (
            <>
              {/* Divider with "or" */}
              <div className="flex items-center gap-4">
                <div className="h-px flex-1 bg-neutral-gray1" />
                <span className="text-sm text-neutral-gray4">{t('or')}</span>
                <div className="h-px flex-1 bg-neutral-gray1" />
              </div>

              {/* Skip for now button */}
              <Button
                className="w-full"
                color="neutral"
                onPress={handleSkipToToS}
              >
                {t('Skip for now')}
              </Button>
            </>
          )}
        </div>
      </FormContainer>
    </div>
  );
};
