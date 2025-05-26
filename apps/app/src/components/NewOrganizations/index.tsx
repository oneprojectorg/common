'use client';

import { makeArray } from '@/utils';
import { trpc } from '@op/api/client';
import { SkeletonLine } from '@op/ui/Skeleton';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

import { Link } from '@/lib/i18n';

import ErrorBoundary from '@/components/ErrorBoundary';

import { OrganizationList } from '../OrganizationList';
import { OrganizationListResponse } from '../Organizations/types';

export const NewOrganizationsSuspense = ({
  limit = 10,
  initialData = [],
}: {
  limit?: number;
  initialData?: any;
}) => {
  const searchParams = useSearchParams();
  const termsFilter = makeArray(searchParams.get('terms'));

  const [{ items: organizations }] = trpc.organization.list.useSuspenseQuery(
    {
      limit,
      terms: termsFilter,
      cursor: null,
    },
    {
      initialData,
    },
  );

  return (
    <div className="flex flex-col gap-4">
      <OrganizationList organizations={organizations} />
      <Link href="/org" className="text-sm text-teal">
        See more
      </Link>
    </div>
  );
};

export const NewOrganizations = ({
  limit,
  initialData,
}: {
  limit?: number;
  initialData?: OrganizationListResponse;
}) => {
  return (
    <ErrorBoundary fallback={<div>Could not load organizations</div>}>
      <Suspense fallback={<SkeletonLine lines={5} />}>
        <NewOrganizationsSuspense initialData={initialData} limit={limit} />
      </Suspense>
    </ErrorBoundary>
  );
};
