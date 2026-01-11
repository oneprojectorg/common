import { createClient } from '@op/api/serverClient';
import { Suspense } from 'react';

import { Link } from '@/lib/i18n';

import {
  OrganizationList,
  OrganizationListSkeleton,
} from '../OrganizationList';
import { TranslatedText } from '../TranslatedText';

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

    return (
      <div className="gap-4 flex flex-col">
        <OrganizationList organizations={organizations} />
        <div className="px-8 sm:px-0">
          <Link href="/org" className="text-teal">
            <TranslatedText text="See more" />
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
