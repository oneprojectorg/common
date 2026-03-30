'use client';

import { trpc } from '@op/api/client';
import type { OrganizationSearchResult } from '@op/api/encoders';
import { useDebounce } from '@op/hooks';
import { Button } from '@op/ui/Button';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { ProfileItem } from '@op/ui/ProfileItem';
import { TextField } from '@op/ui/TextField';
import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { LuPlus, LuSearch, LuX } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { OrganizationAvatar } from '../OrganizationAvatar';
import { OnboardingCenterLayout } from './OnboardingCenterLayout';
import { ToSAcceptanceScreen } from './ToSAcceptanceScreen';

export type OrganizationSearchScreenProps = {
  onContinue: (selectedOrgs: Array<{ id: string; profileId: string }>) => void;
  onAddOrganization?: (searchTerm: string) => void;
  isSubmitting?: boolean;
  initialOrganizations?: OrganizationSearchResult[];
};

export const OrganizationSearchScreen = ({
  onContinue,
  onAddOrganization,
  isSubmitting,
  initialOrganizations,
}: OrganizationSearchScreenProps): ReactNode => {
  const t = useTranslations();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery] = useDebounce(searchQuery, 300);
  const [selectedOrgs, setSelectedOrgs] = useState<OrganizationSearchResult[]>(
    () => initialOrganizations ?? [],
  );
  const [showToS, setShowToS] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [closedByClick, setClosedByClick] = useState(false);

  const isDropdownOpen = debouncedQuery.length >= 2 && !closedByClick;

  const { data: searchResults, isFetching } = trpc.organization.search.useQuery(
    { q: debouncedQuery },
    {
      enabled: debouncedQuery.length >= 2,
      staleTime: 30_000,
      placeholderData: (prev) => prev,
    },
  );

  useEffect(() => {
    setClosedByClick(false);
  }, [debouncedQuery]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setClosedByClick(true);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectOrg = useCallback((org: OrganizationSearchResult) => {
    setSelectedOrgs((prev) => {
      if (prev.some((o) => o.id === org.id)) {
        return prev;
      }
      return [...prev, org];
    });
    setSearchQuery('');
  }, []);

  const handleRemoveOrg = useCallback((orgId: string) => {
    setSelectedOrgs((prev) => prev.filter((o) => o.id !== orgId));
  }, []);

  const handleShowToS = useCallback(() => {
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

  const continueLabel = t('Continue with {count} organizations', {
    count: selectedOrgs.length,
  });

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
    <OnboardingCenterLayout
      title={t('Find organizations you belong to')}
      subtitle={t(
        'Select the organization(s) you want to link to your Common profile. You can add more later from your profile.',
      )}
    >
      <div className="flex w-full flex-col gap-6">
        <div className="flex flex-col gap-4">
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

            {isDropdownOpen && (
              <div className="absolute top-full right-0 left-0 z-10 mt-1 max-h-72 overflow-y-auto rounded-lg border border-neutral-gray1 bg-white shadow-lg">
                <SearchDropdown
                  searchResults={searchResults}
                  isFetching={isFetching}
                  searchQuery={searchQuery}
                  onSelect={handleSelectOrg}
                  onAddOrganization={onAddOrganization}
                />
              </div>
            )}
          </div>

          {hasSelectedOrgs && (
            <div className="flex flex-wrap gap-2">
              {selectedOrgs.map((org) => (
                <SelectedOrgChip
                  key={org.id}
                  org={org}
                  onRemove={() => handleRemoveOrg(org.id)}
                />
              ))}
            </div>
          )}
        </div>

        {hasSelectedOrgs ? (
          <Button className="w-full" onPress={handleShowToS}>
            {continueLabel}
          </Button>
        ) : (
          <>
            <OrDivider />
            <Button className="w-full" color="neutral" onPress={handleShowToS}>
              {t('Skip for now')}
            </Button>
          </>
        )}
      </div>
    </OnboardingCenterLayout>
  );
};

// --- Private sub-components ---

function SearchDropdown({
  searchResults,
  isFetching,
  searchQuery,
  onSelect,
  onAddOrganization,
}: {
  searchResults: OrganizationSearchResult[] | undefined;
  isFetching: boolean;
  searchQuery: string;
  onSelect: (org: OrganizationSearchResult) => void;
  onAddOrganization?: (searchTerm: string) => void;
}) {
  const t = useTranslations();

  if (isFetching && !searchResults) {
    return (
      <div className="flex items-center justify-center py-4">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <>
      {searchResults && searchResults.length > 0 ? (
        searchResults.map((org) => {
          const location = getOrgLocation(org);
          return (
            <button
              key={org.id}
              type="button"
              className="flex w-full items-center px-4 py-3 text-left hover:bg-neutral-offWhite"
              onClick={() => onSelect(org)}
            >
              <ProfileItem
                size="small"
                avatar={
                  <OrganizationAvatar
                    profile={org.profile}
                    withLink={false}
                    className="size-10"
                  />
                }
                title={org.profile?.name ?? ''}
              >
                {location && (
                  <div className="text-xs text-neutral-gray4">{location}</div>
                )}
              </ProfileItem>
            </button>
          );
        })
      ) : (
        <div className="px-4 py-3 text-sm text-neutral-gray4">
          {t('No results')}
        </div>
      )}

      {onAddOrganization && searchQuery && (
        <button
          type="button"
          className="flex w-full items-center gap-2 border-t border-neutral-gray1 px-4 py-3 text-left text-primary-teal hover:bg-neutral-offWhite"
          onClick={() => onAddOrganization(searchQuery)}
        >
          <LuPlus className="size-4" />
          <span className="text-sm">
            {t('Add {searchTerm}', { searchTerm: searchQuery })}
          </span>
        </button>
      )}
    </>
  );
}

function SelectedOrgChip({
  org,
  onRemove,
}: {
  org: OrganizationSearchResult;
  onRemove: () => void;
}) {
  const t = useTranslations();
  const location = getOrgLocation(org);

  return (
    <div className="flex items-center gap-6 rounded-lg border border-neutral-gray1 bg-white px-3 py-2">
      <div className="flex items-center gap-2">
        <OrganizationAvatar
          profile={org.profile}
          withLink={false}
          className="size-6"
        />
        <div className="flex flex-col leading-normal">
          <span className="text-sm text-neutral-charcoal">
            {org.profile?.name}
          </span>
          {location && (
            <span className="text-xs text-neutral-gray4">{location}</span>
          )}
        </div>
      </div>
      <button
        type="button"
        className="rounded-full p-1 text-neutral-gray4 hover:bg-neutral-gray1 hover:text-neutral-charcoal"
        onClick={onRemove}
        aria-label={t('Remove')}
      >
        <LuX className="size-4" />
      </button>
    </div>
  );
}

function OrDivider() {
  const t = useTranslations();
  return (
    <div className="flex items-center gap-4">
      <div className="h-px flex-1 bg-neutral-gray1" />
      <span className="text-sm text-neutral-gray3">{t('or')}</span>
      <div className="h-px flex-1 bg-neutral-gray1" />
    </div>
  );
}

// --- Utilities ---

const getOrgLocation = (org: OrganizationSearchResult): string => {
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
