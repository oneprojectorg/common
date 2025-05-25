import { makeArray } from '@/utils';
import { trpc } from '@op/api/client';
import { SkeletonLine } from '@op/ui/Skeleton';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

import ErrorBoundary from '@/components/ErrorBoundary';

import { OrganizationList } from '../OrganizationList';

export const NewOrganizationsSuspense = ({
  limit = 10,
}: {
  limit?: number;
}) => {
  const searchParams = useSearchParams();
  const termsFilter = makeArray(searchParams.get('terms'));

  const [organizations] = trpc.organization.list.useSuspenseQuery({
    limit,
    terms: termsFilter,
  });

  return <OrganizationList organizations={organizations} />;
};

export const NewOrganizations = ({ limit }: { limit?: number }) => {
  return (
    <ErrorBoundary fallback={<div>Could not load organizations</div>}>
      <Suspense fallback={<SkeletonLine lines={5} />}>
        <NewOrganizationsSuspense limit={limit} />
      </Suspense>
    </ErrorBoundary>
  );
};
