'use client';

import { trpc } from '@op/api/client';
import { EntityType, SearchProfilesResult } from '@op/api/encoders';
import { match } from '@op/core';
import {
  Empty,
  EmptyMedia,
  EmptyHeader,
  EmptyDescription,
} from '@op/sense/Empty';
import { Header1 } from '@op/sense/Header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@op/sense/Tabs';
import { Suspense } from 'react';
import { LuUsers, LuUser } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import ErrorBoundary from '@/components/ErrorBoundary';

import { ProfileListSkeleton, ProfileSummaryList } from '../ProfileList';

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

  return (
    <>
      <Header1 className="text-headline">
        {totalResults > 0 ? (
          <span className="text-muted-foreground">
            {t.rich('Results for <highlight>{query}</highlight>', {
              query: query,
              highlight: (chunks: React.ReactNode) => (
                <span className="font-strong text-foreground">{chunks}</span>
              ),
            })}
          </span>
        ) : (
          <span className="text-muted-foreground">
            {t.rich('No results for <highlight>{query}</highlight>', {
              query: query,
              highlight: (chunks: React.ReactNode) => (
                <span className="font-strong text-foreground">{chunks}</span>
              ),
            })}
          </span>
        )}
      </Header1>

      {totalResults > 0 ? (
        <TabbedProfileSearchResults profiles={profileSearchResults} />
      ) : (
        <div className="flex justify-center">
          <span className="max-w-96 text-center">
            {t(
              'You may want to try using different keywords, checking for typos, or adjusting your filters.',
            )}
          </span>
        </div>
      )}
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
    <Tabs key={defaultSelectedKey} defaultValue={defaultSelectedKey}>
      <TabsList>
        {profiles.map(({ type, results }) => {
          const label = match(type, {
            [EntityType.INDIVIDUAL]: t('Individuals'),
            [EntityType.ORG]: t('Organizations'),
          });
          return (
            <TabsTrigger value={type} className="gap-2" key={`${type}-tab`}>
              {label}
              <span className="text-muted-foreground">{results.length}</span>
            </TabsTrigger>
          );
        })}
      </TabsList>
      {profiles.map(({ type, results }) => {
        const label = match(type, {
          [EntityType.INDIVIDUAL]: t('individuals'),
          [EntityType.ORG]: t('organizations'),
        });
        const icon = match(type, {
          [EntityType.INDIVIDUAL]: <LuUser />,
          [EntityType.ORG]: <LuUsers />,
        });
        return (
          <TabsContent key={`${type}-panel`} value={type} className="mt-6">
            {results.length > 0 ? (
              <ProfileSummaryList profiles={results} />
            ) : (
              <Empty className="rounded border">
                <EmptyHeader>
                  <EmptyMedia variant="icon">{icon}</EmptyMedia>
                  <EmptyDescription>
                    {t('No {type} found.', { type: label })}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </TabsContent>
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
