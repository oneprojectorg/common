import { getPublicUrl } from '@/utils';
import { UserProvider } from '@/utils/UserProvider';
import { trpc } from '@op/trpc/client';
import { Avatar } from '@op/ui/Avatar';
import { FacePile } from '@op/ui/FacePile';
import { Header1, Header3 } from '@op/ui/Header';
import { Skeleton, SkeletonLine } from '@op/ui/Skeleton';
import { Surface } from '@op/ui/Surface';
import { cn } from '@op/ui/utils';
import Image from 'next/image';
import { ReactNode, Suspense } from 'react';

import { Link } from '@/lib/i18n';

import ErrorBoundary from '@/components/ErrorBoundary';
import { NewlyJoinedModal } from '@/components/NewlyJoinedModal';
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
    <div className="text-transparent">
      <div
        className={cn(
          'flex items-center bg-gradient bg-clip-text text-right font-serif text-title-xxl',
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
    <div className="flex h-12 max-w-32 items-center text-neutral-charcoal">
      {children}
    </div>
  );
};

const Highlight = ({ children }: { children?: ReactNode }) => {
  return <div className="flex items-center gap-4">{children}</div>;
};

const NewOrganizationsSuspense = () => {
  const [organizations] = trpc.organization.list.useSuspenseQuery();

  return (
    <div className="flex flex-col gap-6">
      {organizations?.map((org) => {
        const { avatarImage } = org;
        const avatarUrl = getPublicUrl(avatarImage?.name);

        return (
          <div key={org.id}>
            <Link className="flex items-center gap-4" href={`/org/${org.slug}`}>
              <Avatar>
                {avatarUrl ? (
                  <Image src={avatarUrl} alt="" fill className="object-cover" />
                ) : null}
              </Avatar>
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
  );
};

const OrganizationFacePile = () => {
  const [organizations] = trpc.organization.list.useSuspenseQuery({
    limit: 20,
  });
  const [stats] = trpc.organization.getStats.useSuspenseQuery();

  const items = organizations.map((org) => {
    const { avatarImage } = org;
    const avatarUrl = getPublicUrl(avatarImage?.name);
    return (
      <Link key={org.id} href={`/org/${org.slug}`}>
        <Avatar>
          {avatarUrl ? (
            <Image src={avatarUrl} alt="" fill className="object-cover" />
          ) : null}
        </Avatar>
      </Link>
    );
  });

  if (stats.totalOrganizations > 20) {
    items.push(
      <Link key="more" href={`/org`}>
        <Avatar className="bg-neutral-charcoal text-sm text-neutral-offWhite">
          <span className="align-super">+</span>
          {stats.totalOrganizations - 20}
        </Avatar>
      </Link>,
    );
  }

  return <FacePile items={items} />;
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

export const LandingScreen = () => {
  const [user] = trpc.account.getMyAccount.useSuspenseQuery();

  return (
    <div className="container flex min-h-0 grow flex-col gap-4 pt-8 sm:gap-10 sm:pt-14">
      <div className="flex flex-col gap-2">
        <Header1 className="text-center text-title-md sm:text-title-xl">
          Welcome back, {user.name}!
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
      <hr />
      <div className="grid grid-cols-15">
        <div className="col-span-9 flex flex-col gap-4">
          <Suspense fallback={<Skeleton className="h-full w-full" />}>
            <Surface className="mb-4 p-4 pt-5">
              <UserProvider>
                <PostUpdate />
              </UserProvider>
            </Surface>
          </Suspense>
          <hr />
          <div>
            {user.currentOrganization ? (
              <Suspense>
                <Feed organizationId={user.currentOrganization.id} />
              </Suspense>
            ) : null}
          </div>
        </div>
        <span />
        <div className="col-span-5">
          <Surface className="flex flex-col gap-6 p-6">
            <Header3 className="text-title-sm">New Organizations</Header3>
            <ErrorBoundary fallback={<div>Could not load organizations</div>}>
              <Suspense fallback={<SkeletonLine lines={5} />}>
                <NewOrganizationsSuspense />
              </Suspense>
            </ErrorBoundary>
          </Surface>
        </div>
      </div>
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
