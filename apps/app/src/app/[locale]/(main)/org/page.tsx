'use client';

import { NewOrganizations } from '@/components/NewOrganizations';

const OrgListingPage = () => {
  return <NewOrganizations limit={200} />;
};

export default OrgListingPage;
