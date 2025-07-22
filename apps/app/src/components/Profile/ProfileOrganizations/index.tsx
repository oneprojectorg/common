'use client';

import { trpc } from '@op/api/client';
import { SkeletonLine } from '@op/ui/Skeleton';
import { Suspense } from 'react';

import ErrorBoundary from '@/components/ErrorBoundary';
import { OrganizationSummaryList } from '@/components/OrganizationList';

export const ProfileOrganizationsSuspense = ({ 
  profileId 
}: { 
  profileId: string 
}) => {
  const [organizations] = trpc.organization.getOrganizationsByProfile.useSuspenseQuery({
    profileId,
  });

  if (!organizations || organizations.length === 0) {
    return (
      <div className="flex flex-col items-center py-8 text-center text-neutral-gray4">
        <p>No organizations found for this profile</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <OrganizationSummaryList organizations={organizations} />
    </div>
  );
};

export const ProfileOrganizations = ({ 
  profileId 
}: { 
  profileId: string 
}) => {
  return (
    <ErrorBoundary fallback={<div>Could not load organizations</div>}>
      <Suspense fallback={<SkeletonLine lines={5} />}>
        <ProfileOrganizationsSuspense profileId={profileId} />
      </Suspense>
    </ErrorBoundary>
  );
};