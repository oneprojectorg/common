'use client';

import { trpc } from '@op/api/client';
import { Skeleton, SkeletonLine } from '@op/ui/Skeleton';
import { Suspense } from 'react';

import ErrorBoundary from '@/components/ErrorBoundary';
import { OrganizationAvatarSkeleton } from '@/components/OrganizationAvatar';
import { OrganizationSummaryList } from '@/components/OrganizationList';

export const ProfileOrganizationsSuspense = ({
  profileId,
}: {
  profileId: string;
}) => {
  const [organizations] =
    trpc.organization.getOrganizationsByProfile.useSuspenseQuery({
      profileId,
    });

  if (!organizations || organizations.length === 0) {
    return (
      <div className="py-8 flex flex-col items-center text-center text-neutral-gray4">
        <p>No organizations found for this profile</p>
      </div>
    );
  }

  return (
    <div className="gap-6 flex flex-col">
      <OrganizationSummaryList organizations={organizations} />
    </div>
  );
};

const OrganizationSummarySkeleton = () => {
  return (
    <div className="gap-6 flex flex-col">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index}>
          <div className="gap-2 py-2 sm:gap-6 flex items-start">
            <OrganizationAvatarSkeleton className="size-8 sm:size-12" />
            <div className="gap-3 flex flex-col">
              <div className="gap-2 flex flex-col">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-32" />
              </div>
              <SkeletonLine
                lines={2}
                randomWidth={true}
                className="max-w-md w-full"
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export const ProfileOrganizations = ({ profileId }: { profileId: string }) => {
  return (
    <ErrorBoundary fallback={<div>Could not load organizations</div>}>
      <Suspense fallback={<OrganizationSummarySkeleton />}>
        <ProfileOrganizationsSuspense profileId={profileId} />
      </Suspense>
    </ErrorBoundary>
  );
};
