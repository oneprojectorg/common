import { parseDehydratedState } from '@op/api/dehydratedState';
import type { CommonUser, Organization } from '@op/api/encoders';
import { Card } from '@op/sense/Card';
import { Header1, Header3 } from '@op/sense/Header';
import { Skeleton } from '@op/sense/Skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@op/sense/Tabs';
import { HydrationBoundary } from '@tanstack/react-query';
import { Suspense, use, useMemo } from 'react';

import { useTranslations } from '@/lib/i18n';

import { ActiveDecisionsNotifications } from '@/components/ActiveDecisionsNotifications';
import ErrorBoundary from '@/components/ErrorBoundary';
import { JoinProfileRequestsNotifications } from '@/components/JoinProfileRequestsNotifications';
import { NewOrganizations } from '@/components/NewOrganizations';
import { NewlyJoinedModal } from '@/components/NewlyJoinedModal';
import { OrganizationListSkeleton } from '@/components/OrganizationList';
import { PendingDecisionInvites } from '@/components/PendingDecisionInvites';
import { PendingRelationships } from '@/components/PendingRelationships';
import { PlatformHighlights } from '@/components/PlatformHighlights';
import { PostFeedSkeleton } from '@/components/PostFeed';
import { PostUpdate } from '@/components/PostUpdate';

import { Feed } from './Feed';
import { Welcome } from './Welcome';

/**
 * What the home route's loader hands the landing screen. The feed and the new
 * organizations are deferred promises, so the page shell renders immediately
 * and each streams in behind its own Suspense boundary.
 */
interface LandingScreenProps {
  user: CommonUser;
  /** The prefetched query cache, superjson-encoded. */
  feedState: Promise<string>;
  newOrganizations: Promise<Array<Organization> | null>;
}

/**
 * Main landing screen component - renders page shell immediately and
 * streams in the feeds via Suspense boundaries.
 */
export const LandingScreen = ({
  user,
  feedState,
  newOrganizations,
}: LandingScreenProps) => {
  return (
    <div className="mx-auto flex min-h-0 w-full max-w-[1400px] grow flex-col gap-4 px-4 pt-8 sm:gap-10 sm:px-8 sm:pt-14">
      <WelcomeSection user={user} />
      <ErrorBoundary fallback={null}>
        <Suspense
          fallback={
            <Card className="gap-0 py-0">
              <Skeleton className="h-52 w-full" />
            </Card>
          }
        >
          <PlatformHighlights />
        </Suspense>
      </ErrorBoundary>
      <UserContent
        user={user}
        feedState={feedState}
        newOrganizations={newOrganizations}
      />
      <NewlyJoinedModal />
    </div>
  );
};

export const LandingScreenSkeleton = () => {
  const t = useTranslations();

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-[1400px] grow flex-col gap-4 px-4 pt-8 sm:gap-10 sm:px-8 sm:pt-14">
      <div className="flex flex-col gap-2">
        <Skeleton>
          <Header1 className="text-center text-transparent">
            {t('shell.welcomeBackTitle')}
          </Header1>
        </Skeleton>
        <Skeleton className="text-center text-transparent">
          {t('shell.landingSubtitle')}
        </Skeleton>
      </div>

      <Card className="gap-0 py-0">
        <Skeleton className="h-52 w-full" />
      </Card>

      <hr />

      <div className="hidden grid-cols-15 sm:grid">
        <div className="col-span-9 flex flex-col gap-4">
          <Skeleton className="h-full w-full" />
        </div>
        <span />
        <div className="col-span-5">
          <Card className="flex flex-col gap-6 border-0 py-0 sm:border sm:p-6">
            <Skeleton className="text-label text-transparent">
              {t('shell.newOrganizationsHeading')}
            </Skeleton>
            <OrganizationListSkeleton />
          </Card>
        </div>
      </div>

      <Tabs defaultValue="discover" className="pb-8 sm:hidden">
        <TabsList>
          <TabsTrigger value="discover">{t('shell.discoverTab')}</TabsTrigger>
          <TabsTrigger value="recent">{t('shell.recentTab')}</TabsTrigger>
        </TabsList>

        <TabsContent value="discover" className="p-0">
          <Card className="flex flex-col gap-6 border-0 py-0 sm:border sm:p-6">
            <Skeleton className="text-label text-transparent">
              {t('shell.newOrganizationsHeading')}
            </Skeleton>
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

const NewOrganizationsList = ({
  newOrganizations,
}: Pick<LandingScreenProps, 'newOrganizations'>) => {
  const t = useTranslations();

  return (
    <div className="flex flex-col gap-6 border-0 py-0 sm:mx-0 sm:border sm:p-5">
      <Header3 className="px-4 text-label sm:px-0">
        {t('shell.newOrganizationsHeading')}
      </Header3>
      <NewOrganizations organizations={newOrganizations} />
    </div>
  );
};

const PostFeedSection = ({
  showPostUpdate,
  feedState,
}: {
  showPostUpdate: boolean;
} & Pick<LandingScreenProps, 'feedState'>) => {
  const t = useTranslations();

  return (
    <>
      {showPostUpdate ? (
        <Suspense fallback={<Skeleton className="h-full w-full" />}>
          <PostUpdate label={t('Post')} />
        </Suspense>
      ) : null}
      <ErrorBoundary
        fallback={
          <div className="flex flex-col items-center justify-center py-8">
            <span>{t('shell.feedLoadError')}</span>
          </div>
        }
      >
        <Suspense fallback={<PostFeedSkeleton numPosts={3} />}>
          <PrefetchedFeed feedState={feedState} />
        </Suspense>
      </ErrorBoundary>
    </>
  );
};

/** The feed, hydrated with the posts the server prefetched to prevent a hydration mismatch. */
const PrefetchedFeed = ({
  feedState,
}: Pick<LandingScreenProps, 'feedState'>) => {
  const serialized = use(feedState);
  const state = useMemo(() => parseDehydratedState(serialized), [serialized]);

  return (
    <HydrationBoundary state={state}>
      <Feed />
    </HydrationBoundary>
  );
};

const LandingScreenFeeds = ({
  showPostUpdate,
  feedState,
  newOrganizations,
}: {
  showPostUpdate: boolean;
} & Pick<LandingScreenProps, 'feedState' | 'newOrganizations'>) => {
  const t = useTranslations();

  return (
    <>
      <div className="hidden grid-cols-15 sm:grid">
        <div className="col-span-9 flex flex-col gap-8">
          <PostFeedSection
            showPostUpdate={showPostUpdate}
            feedState={feedState}
          />
        </div>
        <span />
        <div className="col-span-5">
          <NewOrganizationsList newOrganizations={newOrganizations} />
        </div>
      </div>
      <Tabs defaultValue="discover" className="gap-8 pb-8 sm:hidden">
        <TabsList>
          <TabsTrigger value="discover">{t('shell.discoverTab')}</TabsTrigger>
          <TabsTrigger value="recent">{t('shell.recentTab')}</TabsTrigger>
        </TabsList>
        <TabsContent value="discover" className="-mx-4 p-0">
          <NewOrganizationsList newOrganizations={newOrganizations} />
        </TabsContent>
        <TabsContent value="recent" className="p-0">
          <div className="flex flex-col gap-8">
            <PostFeedSection
              showPostUpdate={showPostUpdate}
              feedState={feedState}
            />
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
};

const WelcomeSection = ({ user }: Pick<LandingScreenProps, 'user'>) => {
  const t = useTranslations();

  return (
    <div className="flex flex-col gap-2">
      <Welcome user={user} />
      <span className="text-center">{t('shell.landingSubtitle')}</span>
    </div>
  );
};

const UserContent = ({
  user,
  feedState,
  newOrganizations,
}: LandingScreenProps) => {
  return (
    <>
      <PendingDecisionInvites />
      <ActiveDecisionsNotifications />
      {user.currentProfile?.type === 'org' ? (
        <OrgNotifications currentProfile={user.currentProfile} />
      ) : null}
      <hr />
      <LandingScreenFeeds
        showPostUpdate={user.currentProfile?.type === 'org'}
        feedState={feedState}
        newOrganizations={newOrganizations}
      />
    </>
  );
};

/**
 * Organization-specific notifications component.
 * Renders join profile requests and pending relationships for org profiles.
 */
export const OrgNotifications = (props: {
  currentProfile: Organization['profile'];
}) => {
  const { currentProfile } = props;

  return (
    <>
      <JoinProfileRequestsNotifications targetProfileId={currentProfile.id} />
      <PendingRelationships slug={currentProfile.slug} />
    </>
  );
};
