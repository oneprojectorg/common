'use client';

import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { trpc } from '@op/api/client';
import { EntityType, SearchProfilesResult } from '@op/api/encoders';
import { match } from '@op/core';
import { Tab, TabList, TabPanel, Tabs } from '@op/ui/Tabs';
import { useSuspenseQuery } from '@tanstack/react-query';
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
  const individualSearchEnabled = useFeatureFlag('individual_search');

  const { data: profileSearchResults } = useSuspenseQuery({
    queryKey: [
      ['profile', 'search'],
      {
        limit,
        q: query,
        types: individualSearchEnabled
          ? [EntityType.ORG, EntityType.INDIVIDUAL]
          : [EntityType.ORG],
      },
    ],
    queryFn: () =>
      trpc.profile.search.query({
        limit,
        q: query,
        types: individualSearchEnabled
          ? [EntityType.ORG, EntityType.INDIVIDUAL]
          : [EntityType.ORG],
      }),
  });

  const totalResults = profileSearchResults.reduce(
    (acc, curr) => acc + curr.results.length,
    0,
  );

  return totalResults > 0 ? (
    <>
      <ListPageLayoutHeader>
        <span className="text-neutral-gray4">Results for</span>{' '}
        <span className="text-neutral-black">{query}</span>
      </ListPageLayoutHeader>
      {individualSearchEnabled ? (
        <TabbedProfileSearchResults profiles={profileSearchResults} />
      ) : (
        <ProfileSummaryList
          profiles={
            profileSearchResults.find(
              (results) => results.type === EntityType.ORG,
            )?.results || []
          }
        />
      )}
    </>
  ) : (
    <>
      <ListPageLayoutHeader className="flex justify-center gap-2">
        <span className="text-neutral-gray4">No results for </span>
        <span className="text-neutral-black">{query}</span>
      </ListPageLayoutHeader>
      <div className="flex justify-center">
        <span className="max-w-96 text-center text-neutral-black">
          You may want to try using different keywords, checking for typos, or
          adjusting your filters.
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
          const typeName = match(type, {
            [EntityType.INDIVIDUAL]: 'Individual',
            [EntityType.ORG]: 'Organization',
          });
          return (
            <Tab id={type} variant="pill" className="gap-2" key={`${type}-tab`}>
              {t(typeName)}s
              <span className="text-neutral-gray4">{results.length}</span>
            </Tab>
          );
        })}
      </TabList>
      {profiles.map(({ type, results }) => {
        const typeName = match(type, {
          [EntityType.INDIVIDUAL]: 'Individual',
          [EntityType.ORG]: 'Organization',
        });
        return (
          <TabPanel key={`${type}-panel`} id={type}>
            {results.length > 0 ? (
              <ProfileSummaryList profiles={results} />
            ) : (
              <div className="mt-2 w-full rounded p-8 text-center text-neutral-gray4">
                No {t(typeName).toLocaleLowerCase()}s found.
              </div>
            )}
          </TabPanel>
        );
      })}
    </Tabs>
  );
};

export const ProfileSearchResults = ({
  limit,
  query,
}: {
  query: string;
  limit?: number;
}) => {
  return (
    <ErrorBoundary fallback={<div>Could not load search results</div>}>
      <Suspense fallback={<ProfileListSkeleton />}>
        <ProfileSearchResultsSuspense query={query} limit={limit} />
      </Suspense>
    </ErrorBoundary>
  );
};

// Keep the old export for backward compatibility
export const OrganizationSearchResults = ProfileSearchResults;
