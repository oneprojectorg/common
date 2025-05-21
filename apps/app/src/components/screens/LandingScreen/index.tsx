import { getPublicUrl } from '@/utils';
import { UserProvider } from '@/utils/UserProvider';
import { RouterOutput, trpc } from '@op/api/client';
import { Avatar } from '@op/ui/Avatar';
import { FacePile } from '@op/ui/FacePile';
import { Header1, Header3 } from '@op/ui/Header';
import { Skeleton, SkeletonLine } from '@op/ui/Skeleton';
import { Surface } from '@op/ui/Surface';
import { Tab, TabList, TabPanel, Tabs } from '@op/ui/Tabs';
import { cn } from '@op/ui/utils';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import {
  ReactNode,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { Link } from '@/lib/i18n';

import ErrorBoundary from '@/components/ErrorBoundary';
import { ImageHeader } from '@/components/ImageHeader';
import { NewlyJoinedModal } from '@/components/NewlyJoinedModal';
import { OrganizationAvatar } from '@/components/OrganizationAvatar';
import {
  CarouselItem,
  OrganizationCarousel,
} from '@/components/OrganizationCarousel';
import { PendingRelationships } from '@/components/PendingRelationships';
import { PostFeed } from '@/components/PostFeed';
import { PostUpdate } from '@/components/PostUpdate';

const HighlightNumber = ({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) => {
  return (
    <div className="col-span-2 text-transparent">
      <div
        className={cn(
          'flex items-center justify-end bg-gradient bg-clip-text text-right font-serif text-title-xxl',
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
};

const HighlightLabel = ({ children }: { children?: ReactNode }) => {
  return (
    <div className="col-span-3 flex h-12 max-w-32 items-center text-neutral-charcoal">
      {children}
    </div>
  );
};

const Highlight = ({ children }: { children?: ReactNode }) => {
  return (
    <div className="grid w-full grid-cols-5 items-center gap-4 sm:flex">
      {children}
    </div>
  );
};

const NewOrganizationsSuspense = () => {
  const [organizations] = trpc.organization.list.useSuspenseQuery();

  return (
    <>
      <div className="hidden flex-col gap-6 sm:flex">
        {organizations?.map((org) => {
          return (
            <div key={org.id}>
              <Link
                className="flex items-center gap-4"
                href={`/org/${org.slug}`}
              >
                <OrganizationAvatar organization={org} className="size-8" />

                <div className="flex flex-col text-sm">
                  <span>{org.name}</span>
                  <span>{org.city}</span>
                </div>
              </Link>
            </div>
          );
        })}
        <Link href="/org" className="text-sm text-teal">
          See more
        </Link>
      </div>

      {/* mobile */}
      <div className="flex flex-col gap-6 sm:hidden">
        <OrganizationCarousel label="New Organizations" itemWidth={192}>
          <>
            {organizations?.map((org) => {
              const { avatarImage, headerImage } = org;
              const avatarUrl = getPublicUrl(avatarImage?.name);
              const headerUrl = getPublicUrl(headerImage?.name);

              return (
                <CarouselItem key={org.id}>
                  <Surface className="flex size-48">
                    <Link
                      className="flex size-full flex-col gap-3"
                      href={`/org/${org.slug}`}
                    >
                      <ImageHeader
                        headerImage={
                          headerUrl ? (
                            <Image
                              src={headerUrl}
                              alt=""
                              fill
                              className="object-cover"
                            />
                          ) : null
                        }
                        avatarImage={
                          avatarUrl ? (
                            <Image
                              src={avatarUrl}
                              alt=""
                              fill
                              className="object-cover"
                            />
                          ) : null
                        }
                      />

                      <div className="flex flex-col p-4 pt-0 text-left">
                        <span>{org.name}</span>
                        <span>
                          {org.city}
                          {org.state && org.city ? `, ${org.state}` : ''}
                        </span>
                      </div>
                    </Link>
                  </Surface>
                </CarouselItem>
              );
            })}
          </>
        </OrganizationCarousel>
        <Link href="/org" className="text-sm text-teal">
          See more
        </Link>
      </div>
    </>
  );
};

const OrganizationFacePile = () => {
  const [organizations] = trpc.organization.list.useSuspenseQuery({
    limit: 20,
  });
  const [stats] = trpc.organization.getStats.useSuspenseQuery();
  const facePileRef = useRef<HTMLUListElement>(null);
  const [numItems, setNumItems] = useState(20);

  useEffect(() => {
    if (!facePileRef.current) {
      return;
    }

    const resizeObserver = new ResizeObserver((e) => {
      // divide by 2 rem - 0.5 rem overlap
      setNumItems(Math.floor((e[0]?.contentRect.width ?? 1) / (32 - 8)));
    });

    resizeObserver.observe(facePileRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [facePileRef]);

  const items = organizations
    .map((org) => {
      const { avatarImage } = org;
      const avatarUrl = getPublicUrl(avatarImage?.name);
      return (
        <Link key={org.id} href={`/org/${org.slug}`}>
          <Avatar placeholder={org.name}>
            {avatarUrl ? (
              <Image src={avatarUrl} alt="" fill className="object-cover" />
            ) : null}
          </Avatar>
        </Link>
      );
    })
    .slice(0, numItems);

  if (stats.totalOrganizations > numItems) {
    items.push(
      <Link key="more" href={`/org`}>
        <Avatar className="bg-neutral-charcoal text-sm text-neutral-offWhite">
          <span className="align-super">+</span>
          {stats.totalOrganizations - numItems}
        </Avatar>
      </Link>,
    );
  }

  return <FacePile items={items} ref={facePileRef} />;
};

const OrganizationHighlights = () => {
  const [stats] = trpc.organization.getStats.useSuspenseQuery();

  return (
    <Surface className="shadow-light">
      <div className="flex flex-col items-center justify-between gap-6 px-10 py-6 sm:flex-row sm:gap-4">
        <Highlight>
          <HighlightNumber className="bg-tealGreen">
            {stats.newOrganizations}
          </HighlightNumber>
          <HighlightLabel>new organizations to explore</HighlightLabel>
        </Highlight>
        <hr className="hidden h-20 w-0.5 bg-neutral-offWhite sm:block" />
        <Highlight>
          <HighlightNumber className="bg-orange">
            {stats.totalRelationships}
          </HighlightNumber>
          <HighlightLabel>active relationships</HighlightLabel>
        </Highlight>
        <hr className="hidden h-20 w-0.5 bg-neutral-offWhite sm:block" />
        <Highlight>
          <HighlightNumber className="bg-redTeal">
            {stats.totalOrganizations}
          </HighlightNumber>
          <HighlightLabel>organizations on Common</HighlightLabel>
        </Highlight>
      </div>
      <div className="flex flex-col justify-start gap-2 border-0 border-t bg-neutral-offWhite p-6 text-sm text-neutral-charcoal sm:flex-row sm:items-center sm:justify-end">
        <Suspense>
          <OrganizationFacePile />
          are collaborating on Common
        </Suspense>
      </div>
    </Surface>
  );
};

const Feed = ({ organizationId }: { organizationId: string }) => {
  const [posts] = trpc.organization.listRelatedPosts.useSuspenseQuery({
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
        <ErrorBoundary fallback={<div>Could not load organizations</div>}>
          <Suspense fallback={<SkeletonLine lines={5} />}>
            <NewOrganizationsSuspense />
          </Suspense>
        </ErrorBoundary>
      </Surface>
    );
  };

  const PostFeed = () => {
    return (
      <>
        <Suspense fallback={<Skeleton className="h-full w-full" />}>
          <Surface className="mb-8 border-0 p-0 pt-5 sm:mb-4 sm:border sm:p-4">
            <UserProvider>
              <PostUpdate />
            </UserProvider>
          </Surface>
        </Suspense>
        <hr />
        <div className="mt-4 sm:mt-0">
          {user.currentOrganization ? (
            <Suspense>
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

export const LandingScreen = () => {
  const [user] = trpc.account.getMyAccount.useSuspenseQuery();
  const searchParams = useSearchParams();

  const isNew = useMemo(() => {
    return searchParams.get('new') === '1';
  }, []);

  return (
    <div className="container flex min-h-0 grow flex-col gap-4 pt-8 sm:gap-10 sm:pt-14">
      <div className="flex flex-col gap-2">
        <Header1 className="text-center text-title-md sm:text-title-xl">
          {isNew ? `Welcome, ${user.name}!` : `Welcome back, ${user.name}!`}
        </Header1>
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
