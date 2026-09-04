import { createClient } from '@op/api/serverClient';
import { Suspense } from 'react';

import { Link, getTranslations } from '@/lib/i18n';

import {
  OrganizationList,
  OrganizationListSkeleton,
} from '../OrganizationList';

export const NewOrganizationsSuspense = async ({
  limit = 5,
}: {
  limit?: number;
}) => {
  const t = await getTranslations();

  try {
    const client = await createClient();

    const { items: organizations } = await client.organization.list({
      limit,
      cursor: null,
      orderBy: 'createdAt',
    });

    return (
      <div className="flex flex-col gap-4">
        <OrganizationList organizations={organizations} />
        <div className="px-4 sm:px-0">
          <Link href="/org" className="text-primary">
            {t('See more')}
          </Link>
        </div>
      </div>
    );
  } catch (e) {
    return <div>Could not load organizations</div>;
  }
};

export const NewOrganizations = ({ limit }: { limit?: number }) => {
  return (
    <Suspense fallback={<OrganizationListSkeleton />}>
      <NewOrganizationsSuspense limit={limit} />
    </Suspense>
  );
};
