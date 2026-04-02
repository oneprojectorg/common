import { EntityType } from '@op/api/encoders';
import { createClient } from '@op/api/serverClient';

import AllOrganizationsPageClient from '@/components/Organizations/AllOrganizations/AllOrganizationsPageClient';
import {
  ListPageLayout,
  ListPageLayoutHeader,
} from '@/components/layout/ListPageLayout';

export const dynamic = 'force-dynamic';

const ProfileListingPage = async () => {
  try {
    const client = await createClient();
    const organizations = await client.profile.list({
      limit: 5,
      types: [EntityType.INDIVIDUAL],
    });

    return (
      <ListPageLayout>
        <ListPageLayoutHeader>Organizations</ListPageLayoutHeader>

        <AllOrganizationsPageClient
          initialData={organizations}
          types={[EntityType.INDIVIDUAL]}
          limit={20}
        />
      </ListPageLayout>
    );
  } catch (error) {
    return (
      <ListPageLayout>
        <ListPageLayoutHeader>Organizations</ListPageLayoutHeader>

        <AllOrganizationsPageClient
          initialData={{ items: [], next: null }}
          types={[EntityType.USER]}
          limit={20}
        />
      </ListPageLayout>
    );
  }
};

export default ProfileListingPage;
