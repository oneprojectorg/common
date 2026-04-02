import { createClient } from '@op/api/serverClient';
import { SkeletonLine } from '@op/ui/Skeleton';
import { Suspense } from 'react';

import { NewOrganizationsContentClient } from './NewOrganizationsContentClient';

export const NewOrganizationsSuspense = async ({
  limit = 5,
}: {
  limit?: number;
}) => {
  try {
    const client = await createClient();

    const { items: organizations } = await client.organization.list({
      limit,
      cursor: null,
      orderBy: 'createdAt',
    });

    return <NewOrganizationsContentClient organizations={organizations} />;
  } catch (e) {
    return <div>Could not load organizations</div>;
  }
};

export const NewOrganizationsListSkeleton = () => {
  return <SkeletonLine lines={5} />;
};

export const NewOrganizations = ({ limit }: { limit?: number }) => {
  return (
    <Suspense fallback={<NewOrganizationsListSkeleton />}>
      <NewOrganizationsSuspense limit={limit} />
    </Suspense>
  );
};
