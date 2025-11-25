'use client';

import { trpc } from '@op/api/client';
import { Skeleton, SkeletonLine } from '@op/ui/Skeleton';
import { Suspense } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';

import ErrorBoundary from '@/components/ErrorBoundary';
import { OrganizationSummaryList } from '@/components/OrganizationList';
import { OrganizationAvatarSkeleton } from '@/components/OrganizationAvatar';

export const ProfileOrganizationsSuspense = ({
  profileId,
}: {
  profileId: string;
}) => {
  const { data: organizations } = useSuspenseQuery({
    queryKey: [['organization', 'getOrganizationsByProfile'], { profileId }],
    queryFn: () => trpc.organization.getOrganizationsByProfile.query({ profileId }),
  });

  if (!organizations || organizations.length === 0) {
    return (
      <div className="flex flex-col items-center py-8 text-center text-neutral-gray4">
        <p>No organizations found for this profile</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <OrganizationSummaryList organizations={organizations} />
    </div>
  );
};

const OrganizationSummarySkeleton = () => {
  return (
    <div className="flex flex-col gap-6">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index}>
          <div className="flex items-start gap-2 py-2 sm:gap-6">
            <OrganizationAvatarSkeleton className="size-8 sm:size-12" />
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-32" />
              </div>
              <SkeletonLine
                lines={2}
                randomWidth={true}
                className="w-full max-w-md"
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
