import { RouterOutput } from '@op/api/client';
import { createClient } from '@op/api/serverClient';
import { Header1, Header3 } from '@op/ui/Header';
import { Skeleton, SkeletonLine } from '@op/ui/Skeleton';
import { Surface } from '@op/ui/Surface';
import { Tab, TabList, TabPanel, Tabs } from '@op/ui/Tabs';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import ErrorBoundary from '@/components/ErrorBoundary';
import { NewOrganizations } from '@/components/NewOrganizations';
import { NewlyJoinedModal } from '@/components/NewlyJoinedModal';
import { OrganizationHighlights } from '@/components/OrganizationHighlights';
import { OrganizationListSkeleton } from '@/components/OrganizationList';
import { PendingRelationships } from '@/components/PendingRelationships';
import { PostFeedSkeleton } from '@/components/PostFeed';
import { PostUpdate } from '@/components/PostUpdate';
import { TranslatedText } from '@/components/TranslatedText';

import { Feed } from './Feed';
import { Welcome } from './Welcome';

const LandingScreenFeeds = async ({
  user,
}: {
  user: RouterOutput['account']['getMyAccount'];
}) => {
  const NewOrganizationsList = () => {
    return (
      <Surface className="-mx-8 flex flex-col gap-6 border-0 sm:border sm:p-6">
        <Header3 className="px-8 font-serif text-title-sm">
          <TranslatedText text="New Organizations" />
        </Header3>
        <NewOrganizations />
      </Surface>
    );
  };

  const PostFeed = () => {
    return (
      <>
        {user.currentProfile?.type === 'org' ? (
          <>
            <Suspense fallback={<Skeleton className="h-full w-full" />}>
              <Surface className="mb-8 border-0 p-0 pt-5 sm:mb-4 sm:border sm:p-4">
                <PostUpdate label="Post" />
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
            <Suspense fallback={<PostFeedSkeleton numPosts={3} />}>
              <Feed />
            </Suspense>
          </ErrorBoundary>
        </div>
      </>
    );
  };

  return (
    <>
      <div className="hidden grid-cols-15 sm:grid">
        <div className="col-span-9 flex flex-col gap-4">
          <PostFeed />
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
          <PostFeed />
        </TabPanel>
      </Tabs>
    </>
  );
};

export const LandingScreen = async () => {
  try {
    const client = await createClient();
    const user = await client.account.getMyAccount();

    return (
      <div className="container flex min-h-0 grow flex-col gap-4 pt-8 sm:gap-10 sm:pt-14">
        <div className="flex flex-col gap-2">
          <Welcome user={user} />
          <span className="text-center text-neutral-charcoal">
            <TranslatedText text="Explore new connections and strengthen existing relationships." />
          </span>
        </div>
        <Suspense
          fallback={
            <Surface>
              <Skeleton className="h-52 w-full" />
            </Surface>
          }
        >
          <OrganizationHighlights />
        </Suspense>
        {user.currentProfile && user.currentProfile.type === 'org' ? (
          <PendingRelationships slug={user.currentProfile.slug} />
        ) : null}
        <hr />
        <LandingScreenFeeds user={user} />
        <NewlyJoinedModal />
      </div>
    );
  } catch (e) {
    console.error('Failed to load landing screen data:', e);
    if ((e as any)?.data?.code === 'NOT_FOUND') {
      redirect('/start');
    }

    return null;
  }
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
