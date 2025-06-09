import { RouterOutput } from '@op/api/client';
import { trpcNext } from '@op/api/vanilla';
import { Header1, Header3 } from '@op/ui/Header';
import { Skeleton, SkeletonLine } from '@op/ui/Skeleton';
import { Surface } from '@op/ui/Surface';
import { Tab, TabList, TabPanel, Tabs } from '@op/ui/Tabs';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import { NewOrganizations } from '@/components/NewOrganizations';
import { NewlyJoinedModal } from '@/components/NewlyJoinedModal';
import { OrganizationHighlights } from '@/components/OrganizationHighlights';
import { PendingRelationships } from '@/components/PendingRelationships';
import { PostFeed, PostFeedSkeleton } from '@/components/PostFeed';
import { PostUpdate } from '@/components/PostUpdate';

import { Welcome } from './Welcome';

const Feed = async ({ organizationId }: { organizationId: string }) => {
  const client = await trpcNext();
  const posts = await client.organization.listRelatedPosts.query({
    organizationId,
  });

  return <PostFeed posts={posts} />;
};

const LandingScreenFeeds = ({
  user,
}: {
  user: RouterOutput['account']['getMyAccount'];
}) => {
  const NewOrganizationsList = () => {
    return (
      <Surface className="flex flex-col gap-6 border-0 sm:border sm:p-6">
        <Header3 className="font-serif text-title-sm">
          New Organizations
        </Header3>
        <NewOrganizations />
      </Surface>
    );
  };

  const PostFeed = () => {
    return (
      <>
        <Suspense fallback={<Skeleton className="h-full w-full" />}>
          <Surface className="mb-8 border-0 p-0 pt-5 sm:mb-4 sm:border sm:p-4">
            <PostUpdate />
          </Surface>
        </Suspense>
        <hr />
        <div className="mt-4 sm:mt-0">
          {user.currentOrganization ? (
            <Suspense fallback={<PostFeedSkeleton numPosts={3} />}>
              <Feed organizationId={user.currentOrganization.id} />
            </Suspense>
          ) : null}
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
      <Tabs className="pb-8 sm:hidden">
        <TabList variant="pill">
          <Tab id="discover" variant="pill">
            Discover
          </Tab>
          <Tab id="recent" variant="pill">
            Recent
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
    const client = await trpcNext();
    const user = await client.account.getMyAccount.query();

    return (
      <div className="container flex min-h-0 grow flex-col gap-4 pt-8 sm:gap-10 sm:pt-14">
        <div className="flex flex-col gap-2">
          <Welcome user={user} />
          <span className="text-center text-neutral-charcoal">
            Explore new connections and strengthen existing relationships.
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
        {user.currentOrganization ? (
          <PendingRelationships slug={user.currentOrganization.slug} />
        ) : null}
        <hr />
        <LandingScreenFeeds user={user} />
        <NewlyJoinedModal />
      </div>
    );
  } catch (e) {
    if ((e as any)?.data?.code === 'NOT_FOUND') {
      redirect('/start');
    }
  }
};

export const LandingScreenSkeleton: React.FC = () => {
  return (
    <div className="container flex min-h-0 grow flex-col gap-4 pt-8 sm:gap-10 sm:pt-14">
      <div className="flex flex-col gap-2">
        <Skeleton>
          <Header1 className="text-center text-title-md sm:text-title-xl">
            Welcome back, to Common!
          </Header1>
        </Skeleton>
        <Skeleton className="text-center text-neutral-charcoal">
          Explore new connections and strengthen existing relationships.
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
            <Skeleton className="text-title-sm">New Organizations</Skeleton>
            <SkeletonLine lines={5} />
          </Surface>
        </div>
      </div>

      <Tabs className="pb-8 sm:hidden">
        <TabList variant="pill">
          <Tab id="discover" variant="pill">
            Discover
          </Tab>
          <Tab id="recent" variant="pill">
            Recent
          </Tab>
        </TabList>

        <TabPanel id="discover" className="p-0">
          <Surface className="flex flex-col gap-6 border-0 sm:border sm:p-6">
            <Skeleton className="text-title-sm">New Organizations</Skeleton>
            <SkeletonLine lines={5} />
          </Surface>
        </TabPanel>
      </Tabs>
    </div>
  );
};
