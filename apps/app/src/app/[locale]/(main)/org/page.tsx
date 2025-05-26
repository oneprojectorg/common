import { createTRPCVanillaClient } from '@op/api/vanilla';
import { headers } from 'next/headers';

import { AllOrganizations } from '@/components/Organizations/AllOrganizations';
import {
  ListPageLayout,
  ListPageLayoutHeader,
} from '@/components/layout/ListPageLayout';

const OrgListingPage = async () => {
  const organizations = await createTRPCVanillaClient(
    Object.fromEntries(await headers()),
  ).organization.list.query({ limit: 5 });

  return (
    <ListPageLayout>
      <ListPageLayoutHeader>Organizations</ListPageLayoutHeader>

      <AllOrganizations initialData={organizations} limit={2} />
    </ListPageLayout>
  );
};

export default OrgListingPage;
