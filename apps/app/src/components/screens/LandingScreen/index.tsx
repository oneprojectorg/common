import { getPublicUrl } from '@/utils';
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
          'flex items-center bg-gradient bg-clip-text font-serif text-title-xxl',
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

  return organizations?.map((org) => {
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
  });
};

const OrganizationStats = () => {
  const [stats] = trpc.organization.getStats.useSuspenseQuery();

  return (
    <Surface>
      <div className="flex items-center justify-between gap-4 px-10 py-6">
        <Highlight>
          <HighlightNumber className="bg-tealGreen">
            {stats.newOrganizations}
          </HighlightNumber>
          <HighlightLabel>new organizations to explore</HighlightLabel>
        </Highlight>
        <hr className="h-20 w-0.5 bg-neutral-offWhite" />
        <Highlight>
          <HighlightNumber className="bg-orange">
            {stats.totalRelationships}
          </HighlightNumber>
          <HighlightLabel>active relationships</HighlightLabel>
        </Highlight>
        <hr className="h-20 w-0.5 bg-neutral-offWhite" />
        <Highlight>
          <HighlightNumber className="bg-redTeal">
            {stats.totalOrganizations}
          </HighlightNumber>
          <HighlightLabel>organizations on Common</HighlightLabel>
        </Highlight>
      </div>
      <div className="flex items-center justify-end gap-2 border-0 border-t p-6 text-sm text-neutral-charcoal">
        <FacePile
          items={new Array(10).fill(0).map(() => (
            <Avatar>SC</Avatar>
          ))}
        />
        are collaborating on Common
      </div>
    </Surface>
  );
};

export const LandingScreen = () => {
  const [user] = trpc.account.getMyAccount.useSuspenseQuery();

  return (
    <div className="container flex min-h-0 grow flex-col gap-10 pt-14">
      <div className="flex flex-col gap-6">
        <Header1 className="text-center">Welcome back, {user.name}!</Header1>
        <span className="text-center text-neutral-charcoal">
          Explore new connections and strengthen existing relationships.
        </span>
      </div>
      <Suspense
        fallback={
          <Surface>
            <Skeleton className="h-96 w-full" />
          </Surface>
        }
      >
        <OrganizationStats />
      </Suspense>
      <hr />
      <div className="grid grid-cols-15">
        <div className="col-span-9 flex flex-col gap-8">
          <Surface>feed post</Surface>
          <hr />
          <div>THE FEED</div>
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
