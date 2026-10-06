import type { Organization } from '@op/api/encoders';
import { Suspense, use } from 'react';

import { Link, useTranslations } from '@/lib/i18n';

import {
  OrganizationList,
  OrganizationListSkeleton,
} from '../OrganizationList';

/** `organizations` resolves to null when they couldn't be loaded. */
type NewOrganizationsPromise = Promise<Array<Organization> | null>;

export const NewOrganizationsSuspense = ({
  organizations: organizationsPromise,
}: {
  organizations: NewOrganizationsPromise;
}) => {
  const t = useTranslations('org');
  const organizations = use(organizationsPromise);

  if (!organizations) {
    return <div>Could not load organizations</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      <OrganizationList organizations={organizations} />
      <div className="px-4 sm:px-0">
        <Link href="/org" className="text-primary">
          {t('seeMoreAction')}
        </Link>
      </div>
    </div>
  );
};

export const NewOrganizations = ({
  organizations,
}: {
  organizations: NewOrganizationsPromise;
}) => {
  return (
    <Suspense fallback={<OrganizationListSkeleton />}>
      <NewOrganizationsSuspense organizations={organizations} />
    </Suspense>
  );
};
