import { getUser } from '@/utils/getUser';
import { Organization } from '@op/api/encoders';
import {
  HydrationBoundary,
  createServerUtils,
  dehydrate,
} from '@op/api/server';
import { Header1, Header3 } from '@op/ui/Header';
import { Skeleton, SkeletonLine } from '@op/ui/Skeleton';
import { Surface } from '@op/ui/Surface';
import { Tab, TabList, TabPanel, Tabs } from '@op/ui/Tabs';
import { Suspense } from 'react';

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
import { TranslatedText } from '@/components/TranslatedText';

import { Feed } from './Feed';
import { Welcome } from './Welcome';

/**
 * Main landing screen component - renders page shell immediately and
 * streams in user-dependent content via Suspense boundaries.
 */
export const LandingScreen = () => {
  return (
    <div className="container flex min-h-0 grow flex-col gap-4 pt-8 sm:gap-10 sm:pt-14">
      <Suspense fallback={<WelcomeSkeleton />}>
        <WelcomeSection />
      </Suspense>
      <Suspense
        fallback={
          <Surface>
            <Skeleton className="h-52 w-full" />
          </Surface>
        }
      >
        <PlatformHighlights />
      </Suspense>
      <Suspense fallback={<UserContentSkeleton />}>
        <UserContent />
      </Suspense>
      <NewlyJoinedModal />
    </div>
  );
};

export const LandingScreenSkeleton: React.FC = async () => {
  return (
    <div className="container flex min-h-0 grow flex-col gap-4 pt-8 sm:gap-10 sm:pt-14">
      <div className="flex flex-col gap-2">
        <Skeleton>
          <Header1 className="text-center text-title-md text-transparent sm:text-title-xl">
            <TranslatedText text="Welcome back, to Common!" />
          </Header1>
        </Skeleton>
        <Skeleton className="text-center text-transparent">
          <TranslatedText text="Explore new connections and strengthen existing relationships." />
        </Skeleton>
      </div>

      <Surface>
        <Skeleton className="h-52 w-full" />
      </Surface>

      <hr />

      <div className="hidden grid-cols-15 sm:grid">
        <div className="col-span-9 flex flex-col gap-4">
          <Skeleton className="h-full w-full" />
        </div>
        <span />
        <div className="col-span-5">
          <Surface className="flex flex-col gap-6 border-0 sm:border sm:p-6">
            <Skeleton className="text-title-sm">
              <TranslatedText text="New Organizations" />
            </Skeleton>
            <OrganizationListSkeleton />
          </Surface>
        </div>
      </div>

      <Tabs className="pb-8 sm:hidden">
        <TabList variant="pill">
          <Tab id="discover" variant="pill">
            <TranslatedText text="Discover" />
          </Tab>
          <Tab id="recent" variant="pill">
            <TranslatedText text="Recent" />
          </Tab>
        </TabList>

        <TabPanel id="discover" className="p-0">
          <Surface className="flex flex-col gap-6 border-0 sm:border sm:p-6">
            <Skeleton className="text-title-sm">
              <TranslatedText text="New Organizations" />
            </Skeleton>
            <SkeletonLine lines={5} />
          </Surface>
        </TabPanel>
      </Tabs>
    </div>
  );
};

const NewOrganizationsList = () => {
  return (
    <Surface className="-mx-8 flex flex-col gap-6 border-0 sm:mx-0 sm:border sm:p-6">
      <Header3 className="px-8 font-serif text-title-sm sm:px-0">
        <TranslatedText text="New Organizations" />
      </Header3>
      <NewOrganizations />
    </Surface>
  );
};

const PostFeedSection = async ({
  showPostUpdate,
}: {
  showPostUpdate: boolean;
}) => {
  // Prefetch posts data on server to prevent hydration mismatch
  // If this fails, the client will fetch instead
  const { utils, queryClient } = await createServerUtils();
  try {
    await utils.organization.listAllPosts.prefetchInfinite({ limit: 10 });
  } catch {
    // Silently fail, client will still fetch
  }

  return (
    <>
      {showPostUpdate ? (
        <>
          <Suspense fallback={<Skeleton className="h-full w-full" />}>
            <Surface className="mb-8 border-0 p-0 pt-5 sm:mb-4 sm:border sm:p-4">
              <PostUpdate label={<TranslatedText text="Post" />} />
            </Surface>
          </Suspense>
          <hr />
        </>
      ) : null}
      <div className="mt-4 sm:mt-0">
        <ErrorBoundary
          fallback={
            <div className="flex flex-col items-center justify-center py-8">
              <span className="text-neutral-charcoal">
                <TranslatedText text="Unable to load posts. Please try refreshing." />
              </span>
            </div>
          }
        >
          <HydrationBoundary state={dehydrate(queryClient)}>
            <Feed />
          </HydrationBoundary>
        </ErrorBoundary>
      </div>
    </>
  );
};

const LandingScreenFeeds = ({
  showPostUpdate,
}: {
  showPostUpdate: boolean;
}) => {
  return (
    <>
      <div className="hidden grid-cols-15 sm:grid">
        <div className="col-span-9 flex flex-col gap-4">
          <PostFeedSection showPostUpdate={showPostUpdate} />
        </div>
        <span />
        <div className="col-span-5">
          <NewOrganizationsList />
        </div>
      </div>
      <Tabs className="gap-8 pb-8 sm:hidden">
        <TabList variant="pill">
          <Tab id="discover" variant="pill">
            <TranslatedText text="Discover" />
          </Tab>
          <Tab id="recent" variant="pill">
            <TranslatedText text="Recent" />
          </Tab>
        </TabList>
        <TabPanel id="discover" className="p-0">
          <NewOrganizationsList />
        </TabPanel>
        <TabPanel id="recent" className="p-0">
          <PostFeedSection showPostUpdate={showPostUpdate} />
        </TabPanel>
      </Tabs>
    </>
  );
};

/**
 * Async component that fetches user data and renders user-dependent content.
 */
const WelcomeSection = async () => {
  const user = await getUser();

  return (
    <div className="flex flex-col gap-2">
      <Welcome user={user} />
      <span className="text-center text-neutral-charcoal">
        <TranslatedText text="Explore new connections and strengthen existing relationships." />
      </span>
    </div>
  );
};

const WelcomeSkeleton = () => {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton>
        <Header1 className="text-center text-title-md text-transparent sm:text-title-xl">
          <TranslatedText text="Welcome back, to Common!" />
        </Header1>
      </Skeleton>
      <Skeleton className="text-center text-transparent">
        <TranslatedText text="Explore new connections and strengthen existing relationships." />
      </Skeleton>
    </div>
  );
};

const UserContent = async () => {
  const user = await getUser();

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

const UserContentSkeleton = () => {
  return (
    <>
      <hr />
      <div className="hidden grid-cols-15 sm:grid">
        <div className="col-span-9 flex flex-col gap-4">
          <PostFeedSkeleton numPosts={3} />
        </div>
        <span />
        <div className="col-span-5">
          <Surface className="flex flex-col gap-6 border-0 sm:border sm:p-6">
            <Skeleton className="text-title-sm">
              <TranslatedText text="New Organizations" />
            </Skeleton>
            <OrganizationListSkeleton />
          </Surface>
        </div>
      </div>
    </>
  );
};
