import { getRequiredUser } from '@/utils/getUser';
import { Organization } from '@op/api/encoders';
import {
  HydrationBoundary,
  createServerUtils,
  dehydrate,
} from '@op/api/server';
import { logger } from '@op/logging';
import { Card } from '@op/sense/Card';
import { Header1, Header3 } from '@op/sense/Header';
import { Skeleton } from '@op/sense/Skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@op/sense/Tabs';
import { Suspense } from 'react';

import { getTranslations } from '@/lib/i18n';

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
 * Main landing screen component - renders page shell immediately and
 * streams in user-dependent content via Suspense boundaries.
 */
export const LandingScreen = () => {
  return (
    <div className="mx-auto flex min-h-0 w-full max-w-[1400px] grow flex-col gap-4 px-4 pt-8 sm:gap-10 sm:px-8 sm:pt-14">
      <Suspense fallback={<WelcomeSkeleton />}>
        <WelcomeSection />
      </Suspense>
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
      <Suspense fallback={<UserContentSkeleton />}>
        <UserContent />
      </Suspense>
      <NewlyJoinedModal />
    </div>
  );
};

export const LandingScreenSkeleton: React.FC = async () => {
  const t = await getTranslations();

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-[1400px] grow flex-col gap-4 px-4 pt-8 sm:gap-10 sm:px-8 sm:pt-14">
      <div className="flex flex-col gap-2">
        <Skeleton>
          <Header1 className="text-center text-transparent">
            {t('Welcome back, to Common!')}
          </Header1>
        </Skeleton>
        <Skeleton className="text-center text-transparent">
          {t('Explore new connections and strengthen existing relationships.')}
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
              {t('New Organizations')}
            </Skeleton>
            <OrganizationListSkeleton />
          </Card>
        </div>
      </div>

      <Tabs defaultValue="discover" className="pb-8 sm:hidden">
        <TabsList>
          <TabsTrigger value="discover">{t('Discover')}</TabsTrigger>
          <TabsTrigger value="recent">{t('Recent')}</TabsTrigger>
        </TabsList>

        <TabsContent value="discover" className="p-0">
          <Card className="flex flex-col gap-6 border-0 py-0 sm:border sm:p-6">
            <Skeleton className="text-label text-transparent">
              {t('New Organizations')}
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

const NewOrganizationsList = async () => {
  const t = await getTranslations();

  return (
    <div className="flex flex-col gap-6 border-0 py-0 sm:mx-0 sm:border sm:p-5">
      <Header3 className="px-4 text-label sm:px-0">
        {t('New Organizations')}
      </Header3>
      <NewOrganizations />
    </div>
  );
};

const PostFeedSection = async ({
  showPostUpdate,
}: {
  showPostUpdate: boolean;
}) => {
  // Prefetch posts data on server to prevent hydration mismatch
  // If this fails, the client will fetch instead
  const [t, { utils, queryClient }] = await Promise.all([
    getTranslations(),
    createServerUtils(),
  ]);
  try {
    await utils.organization.listAllPosts.fetchInfinite({ limit: 10 });
  } catch (e) {
    logger.error('Homepage post prefetch failed', { error: e });
  }

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
            <span>{t('Unable to load posts. Please try refreshing.')}</span>
          </div>
        }
      >
        <HydrationBoundary state={dehydrate(queryClient)}>
          <Feed />
        </HydrationBoundary>
      </ErrorBoundary>
    </>
  );
};

const LandingScreenFeeds = async ({
  showPostUpdate,
}: {
  showPostUpdate: boolean;
}) => {
  const t = await getTranslations();

  return (
    <>
      <div className="hidden grid-cols-15 sm:grid">
        <div className="col-span-9 flex flex-col gap-8">
          <PostFeedSection showPostUpdate={showPostUpdate} />
        </div>
        <span />
        <div className="col-span-5">
          <NewOrganizationsList />
        </div>
      </div>
      <Tabs defaultValue="discover" className="gap-8 pb-8 sm:hidden">
        <TabsList>
          <TabsTrigger value="discover">{t('Discover')}</TabsTrigger>
          <TabsTrigger value="recent">{t('Recent')}</TabsTrigger>
        </TabsList>
        <TabsContent value="discover" className="-mx-4 p-0">
          <NewOrganizationsList />
        </TabsContent>
        <TabsContent value="recent" className="p-0">
          <div className="flex flex-col gap-8">
            <PostFeedSection showPostUpdate={showPostUpdate} />
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
};

/**
 * Async component that fetches user data and renders user-dependent content.
 */
const WelcomeSection = async () => {
  const [t, user] = await Promise.all([getTranslations(), getRequiredUser()]);

  return (
    <div className="flex flex-col gap-2">
      <Welcome user={user} />
      <span className="text-center">
        {t('Explore new connections and strengthen existing relationships.')}
      </span>
    </div>
  );
};

const WelcomeSkeleton = async () => {
  const t = await getTranslations();

  return (
    <div className="flex flex-col gap-2">
      <Skeleton>
        <Header1 className="text-center text-transparent">
          {t('Welcome back, to Common!')}
        </Header1>
      </Skeleton>
      <Skeleton className="text-center text-transparent">
        {t('Explore new connections and strengthen existing relationships.')}
      </Skeleton>
    </div>
  );
};

const UserContent = async () => {
  const user = await getRequiredUser();

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
      />
    </>
  );
};

/**
 * Organization-specific notifications component.
 * Renders join profile requests and pending relationships for org profiles.
 */
export const OrgNotifications = async (props: {
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

const UserContentSkeleton = async () => {
  const t = await getTranslations();

  return (
    <>
      <hr />
      <div className="hidden grid-cols-15 sm:grid">
        <div className="col-span-9 flex flex-col gap-4">
          <PostFeedSkeleton numPosts={3} />
        </div>
        <span />
        <div className="col-span-5">
          <Card className="flex flex-col gap-6 border-0 py-0 sm:border sm:p-6">
            <Skeleton className="text-label text-transparent">
              {t('New Organizations')}
            </Skeleton>
            <OrganizationListSkeleton />
          </Card>
        </div>
      </div>
    </>
  );
};
