import { trpcNext } from '@op/api/vanilla';
import { SkeletonLine } from '@op/ui/Skeleton';
import { Suspense } from 'react';

import { Link } from '@/lib/i18n';

import { OrganizationList } from '../OrganizationList';

export const NewOrganizationsSuspense = async ({
  limit = 10,
}: {
  limit?: number;
}) => {
  try {
    const client = await trpcNext();

    const { items: organizations } = await client.organization.list.query({
      limit,
      cursor: null,
    });

    return (
      <div className="flex flex-col gap-4">
        <OrganizationList organizations={organizations} />
        <Link href="/org" className="text-sm text-teal">
          See more
        </Link>
      </div>
    );
  } catch (e) {
    return <div>Could not load organizations</div>;
  }
};

export const NewOrganizations = ({ limit }: { limit?: number }) => {
  return (
    <Suspense fallback={<SkeletonLine lines={5} />}>
      <NewOrganizationsSuspense limit={limit} />
    </Suspense>
  );
};
