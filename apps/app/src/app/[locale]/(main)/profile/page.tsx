import { trpcNext } from '@op/api/vanilla';
import { EntityType } from '@op/api/encoders';

import { AllOrganizations } from '@/components/Organizations/AllOrganizations';
import {
  ListPageLayout,
  ListPageLayoutHeader,
} from '@/components/layout/ListPageLayout';

const OrgListingPage = async () => {
  try {
    const client = await trpcNext();
    const organizations = await client.profile.list.query({ 
      limit: 5, 
      types: [EntityType.USER] 
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

        <AllOrganizations
          initialData={{ items: [], hasMore: false, next: null }}
          limit={20}
        />
      </ListPageLayout>
    );
  }
};

export default OrgListingPage;
