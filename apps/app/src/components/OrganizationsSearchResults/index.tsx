'use client';

import { trpc } from '@op/api/client';
import { EntityType, SearchProfilesResult } from '@op/api/encoders';
import { match } from '@op/core';
import { Tab, TabList, TabPanel, Tabs } from '@op/ui/Tabs';
import { Suspense } from 'react';

import { useTranslations } from '@/lib/i18n';

import ErrorBoundary from '@/components/ErrorBoundary';

import { ProfileListSkeleton, ProfileSummaryList } from '../ProfileList';
import { ListPageLayoutHeader } from '../layout/ListPageLayout';

export const ProfileSearchResultsSuspense = ({
  query,
  limit = 10,
}: {
  query: string;
  limit?: number;
}) => {
  const t = useTranslations();

  const [profileSearchResults] = trpc.profile.search.useSuspenseQuery({
    limit,
    q: query,
    types: [EntityType.ORG, EntityType.INDIVIDUAL],
  });

  const totalResults = profileSearchResults.reduce(
    (acc, curr) => acc + curr.results.length,
    0,
  );

  return totalResults > 0 ? (
    <>
      <ListPageLayoutHeader>
        <span className="text-muted-foreground">
          {t.rich('Results for <highlight>{query}</highlight>', {
            query: query,
            highlight: (chunks: React.ReactNode) => (
              <span className="text-foreground">{chunks}</span>
            ),
          })}
        </span>
      </ListPageLayoutHeader>
      <TabbedProfileSearchResults profiles={profileSearchResults} />
    </>
  ) : (
    <>
      <ListPageLayoutHeader className="flex justify-center gap-2">
        <span className="text-muted-foreground">
          {t.rich('No results for <highlight>{query}</highlight>', {
            query: query,
            highlight: (chunks: React.ReactNode) => (
              <span className="text-foreground">{chunks}</span>
            ),
          })}
        </span>
      </ListPageLayoutHeader>
      <div className="flex justify-center">
        <span className="max-w-96 text-center text-foreground">
          {t(
            'You may want to try using different keywords, checking for typos, or adjusting your filters.',
          )}
        </span>
      </div>
    </>
  );
};

export const TabbedProfileSearchResults = ({
  profiles,
}: {
  profiles: SearchProfilesResult;
}) => {
  const defaultSelectedKey =
    profiles.find((profileType) => profileType.results.length > 0)?.type ||
    EntityType.ORG;

  const t = useTranslations();

  return (
    // Use the defaultSelectedKey as the key for the Tabs component so that it switches to the tab with available results.
    <Tabs key={defaultSelectedKey} defaultSelectedKey={defaultSelectedKey}>
      <TabList variant="pill">
        {profiles.map(({ type, results }) => {
          const label = match(type, {
            [EntityType.INDIVIDUAL]: t('Individuals'),
            [EntityType.ORG]: t('Organizations'),
          });
          return (
            <Tab id={type} variant="pill" className="gap-2" key={`${type}-tab`}>
              {label}
              <span className="text-muted-foreground">{results.length}</span>
            </Tab>
          );
        })}
      </TabList>
      {profiles.map(({ type, results }) => {
        const label = match(type, {
          [EntityType.INDIVIDUAL]: t('individuals'),
          [EntityType.ORG]: t('organizations'),
        });
        return (
          <TabPanel key={`${type}-panel`} id={type}>
            {results.length > 0 ? (
              <ProfileSummaryList profiles={results} />
            ) : (
              <div className="mt-2 w-full rounded p-8 text-center text-muted-foreground">
                {t('No {type} found.', { type: label })}
              </div>
            )}
          </TabPanel>
        );
      })}
    </Tabs>
  );
};

const SearchResultsErrorFallback = () => {
  const t = useTranslations();
  return <div>{t('Could not load search results')}</div>;
};

export const ProfileSearchResults = ({
  limit,
  query,
}: {
  query: string;
  limit?: number;
}) => {
  return (
    <ErrorBoundary fallback={<SearchResultsErrorFallback />}>
      <Suspense fallback={<ProfileListSkeleton />}>
        <ProfileSearchResultsSuspense query={query} limit={limit} />
      </Suspense>
    </ErrorBoundary>
  );
};

// Keep the old export for backward compatibility
export const OrganizationSearchResults = ProfileSearchResults;
