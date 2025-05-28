import { RouterOutput } from '@op/api/client';
import { trpcNext } from '@op/api/vanilla';
import { Header3 } from '@op/ui/Header';
import { Skeleton, SkeletonLine } from '@op/ui/Skeleton';
import { Surface } from '@op/ui/Surface';
import { Tab, TabList, TabPanel, Tabs } from '@op/ui/Tabs';
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
        <Header3 className="text-title-sm">New Organizations</Header3>
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
};

export const LandingScreenSkeleton: React.FC = () => {
  return (
    <div className="container flex min-h-0 grow flex-col gap-8 pt-14">
      <div className="flex flex-col gap-6">
        <Skeleton className="mx-auto h-10 w-1/2" />
        <SkeletonLine className="mx-auto h-5 w-2/3" />
      </div>
      <div>
        <div className="mb-8 flex justify-center gap-4">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-32" />
        </div>
        <div className="flex flex-col gap-8">
          <SkeletonLine className="mb-4 h-7 w-48" />
          <div className="grid grid-cols-3 gap-8">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="flex w-60 flex-col gap-3 overflow-hidden rounded-md border border-gray-200 bg-white p-3"
              >
                <Skeleton className="mb-3 h-32 w-full" />
                <Skeleton className="mx-auto mb-3 h-12 w-12 rounded-full" />
                <SkeletonLine className="mx-auto mb-2 h-6 w-32" />
                <SkeletonLine className="mx-auto h-4 w-20" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
