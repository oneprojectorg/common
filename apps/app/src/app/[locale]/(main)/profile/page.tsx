import { EntityType } from '@op/api/encoders';
import { trpcNext } from '@op/api/vanilla';

import { AllOrganizations } from '@/components/Organizations/AllOrganizations';
import {
  ListPageLayout,
  ListPageLayoutHeader,
} from '@/components/layout/ListPageLayout';

const ProfileListingPage = async () => {
  try {
    const client = await trpcNext();
    const organizations = await client.profile.list.query({
      limit: 5,
      types: [EntityType.USER],
    });

    return (
      <ListPageLayout>
        <ListPageLayoutHeader>Organizations</ListPageLayoutHeader>

        <AllOrganizations
          initialData={organizations}
          types={[EntityType.USER]}
          limit={20}
        />
      </ListPageLayout>
    );
  } catch (error) {
    return (
      <ListPageLayout>
        <ListPageLayoutHeader>Organizations</ListPageLayoutHeader>

        <AllOrganizations
          initialData={{ items: [], hasMore: false, next: null }}
          types={[EntityType.USER]}
          limit={20}
        />
      </ListPageLayout>
    );
  }
};

export default ProfileListingPage;
