import { trpcVanilla } from '@op/api/vanilla';

import { NewOrganizations } from '@/components/NewOrganizations';

const OrgListingPage = async () => {
  // const organizations = await trpcVanilla.organization.list.query();
  // console.log('organizations', organizations);

  return <NewOrganizations limit={5} />;
};

export default OrgListingPage;
