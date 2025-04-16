'use client';

import { ImageHeader } from '@/components/ImageHeader';
import { ProfileDetails } from '@/components/Profile/ProfileDetails';
import { ProfileTabs } from '@/components/Profile/ProfileTabs';
import { ErrorBoundary } from 'next/dist/client/components/error-boundary';
import { Suspense } from 'react';

import { trpc } from '@op/trpc/client';

const OrganizationProfileSuspense = ({ id }: { id: string }) => {
  const [organization] = trpc.organization.getById.useSuspenseQuery({
    organizationId: id,
  });

  return (
    <>
      <ImageHeader />
      <ProfileDetails profile={organization} />
      <ProfileTabs />
    </>
  );
};

export const OrganizationProfile = ({ id }: { id: string }) => {
  return (
    <div className="flex w-full flex-col gap-3 outline outline-1 -outline-offset-1 outline-offWhite">
      <ErrorBoundary errorComponent={() => <div>Could not load profile</div>}>
        <Suspense fallback={<div>Loading...</div>}>
          <OrganizationProfileSuspense id={id} />
        </Suspense>
      </ErrorBoundary>
    </div>
  );
};
