'use client';

import { SkeletonLine } from '@op/ui/Skeleton';
import { Suspense } from 'react';

import ErrorBoundary from '@/components/ErrorBoundary';
import { NewOrganizationsSuspense } from '@/components/screens/LandingScreen';

const OrgListingPage = () => {
  return (
    <ErrorBoundary fallback={<div>Could not load organizations</div>}>
      <Suspense fallback={<SkeletonLine lines={5} />}>
        <h1>UNSTYLED Organization Listing </h1>
        <NewOrganizationsSuspense limit={200} />
      </Suspense>
    </ErrorBoundary>
  );
};

export default OrgListingPage;
