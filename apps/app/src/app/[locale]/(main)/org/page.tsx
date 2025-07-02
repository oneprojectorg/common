import { trpcNext } from '@op/api/vanilla';

import { AllOrganizations } from '@/components/Organizations/AllOrganizations';
import {
  ListPageLayout,
  ListPageLayoutHeader,
} from '@/components/layout/ListPageLayout';

const OrgListingPage = async () => {
  try {
    const client = await trpcNext();
    const organizations = await client.organization.list.query({ limit: 5 });

    return (
      <ListPageLayout>
        <ListPageLayoutHeader>Organizations</ListPageLayoutHeader>

        <AllOrganizations initialData={organizations} limit={20} />
      </ListPageLayout>
    );
  } catch (error) {
    return (
      <ListPageLayout>
        <ListPageLayoutHeader>Organizations</ListPageLayoutHeader>

        <AllOrganizations
          initialData={{ items: [], hasMore: false }}
          limit={20}
        />
      </ListPageLayout>
    );
  }
};

export default OrgListingPage;
