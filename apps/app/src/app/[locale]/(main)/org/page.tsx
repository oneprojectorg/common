import { createTRPCVanillaClient } from '@op/api/vanilla';
import { headers } from 'next/headers';

import { NewOrganizations } from '@/components/NewOrganizations';

const OrgListingPage = async () => {
  const organizations = await createTRPCVanillaClient(
    Object.fromEntries(await headers()),
  ).organization.list.query();

  return <NewOrganizations initialData={organizations} limit={5} />;
};

export default OrgListingPage;
