'use client';

import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { RouterOutput, trpc } from '@op/api/client';
import { EntityType } from '@op/api/encoders';
import { Tab, TabList, TabPanel, Tabs } from '@op/ui/Tabs';
import { Suspense } from 'react';

import ErrorBoundary from '@/components/ErrorBoundary';
import { TranslatedText } from '@/components/TranslatedText';

import { ProfileListSkeleton, ProfileSummaryList } from '../ProfileList';
import { ListPageLayoutHeader } from '../layout/ListPageLayout';

type Profiles = RouterOutput['profile']['list']['items'];

export const ProfileSearchResultsSuspense = ({
  query,
  limit = 10,
}: {
  query: string;
  limit?: number;
}) => {
  const individualSearchEnabled = useFeatureFlag('individual_search');

  const [profiles] = trpc.profile.search.useSuspenseQuery({
    limit,
    q: query,
    types: individualSearchEnabled
      ? [EntityType.INDIVIDUAL, EntityType.ORG]
      : [EntityType.ORG],
  });

  return profiles.length > 0 ? (
    <>
      <ListPageLayoutHeader>
        <span className="text-neutral-gray4">Results for</span>{' '}
        <span className="text-neutral-black">{query}</span>
      </ListPageLayoutHeader>
      {individualSearchEnabled ? (
        <TabbedProfileSearchResults profiles={profiles} />
      ) : (
        <ProfileSummaryList profiles={profiles} />
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
  profiles: Profiles;
}) => {
  const orgProfiles = profiles.filter((profile) => profile.type === 'org');
  const individualProfiles = profiles.filter(
    (profile) => profile.type === 'individual',
  );

  const defaultSelectedKey =
    orgProfiles.length > 0 ? 'organizations' : 'individuals';

  return (
    <Tabs defaultSelectedKey={defaultSelectedKey}>
      <TabList variant="pill">
        <Tab id="organizations" variant="pill" className="gap-2">
          <TranslatedText text="Organizations" />{' '}
          <span className="text-neutral-gray4">{orgProfiles.length}</span>
        </Tab>
        <Tab id="individuals" variant="pill" className="gap-2">
          <TranslatedText text="Individuals" />{' '}
          <span className="text-neutral-gray4">
            {individualProfiles.length}
          </span>
        </Tab>
      </TabList>
      <TabPanel id="organizations" className="sm:px-0">
        {orgProfiles.length > 0 ? (
          <ProfileSummaryList profiles={orgProfiles} />
        ) : (
          <div className="mt-2 w-full rounded p-8 text-center text-neutral-gray4">
            No organizations found.
          </div>
        )}
      </TabPanel>
      <TabPanel id="individuals" className="sm:px-0">
        {individualProfiles.length > 0 ? (
          <ProfileSummaryList profiles={individualProfiles} />
        ) : (
          <div className="mt-2 w-full rounded p-8 text-center text-neutral-gray4">
            No individuals found.
          </div>
        )}
      </TabPanel>
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
