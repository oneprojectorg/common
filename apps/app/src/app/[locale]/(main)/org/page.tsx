import { EntityType } from '@op/api/encoders';
import { createClient } from '@op/api/serverClient';

import { AllOrganizations } from '@/components/Organizations/AllOrganizations';
import {
  ListPageLayout,
  ListPageLayoutHeader,
} from '@/components/layout/ListPageLayout';

export const dynamic = 'force-dynamic';

const OrgListingPage = async () => {
  try {
    const client = await createClient();
    const organizations = await client.profile.list({
      limit: 50,
      types: [EntityType.ORG],
    });

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

        <AllOrganizations initialData={{ items: [], next: null }} limit={20} />
      </ListPageLayout>
    );
  }
};

export default OrgListingPage;
