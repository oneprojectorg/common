import { EntityType } from '@op/api/encoders';
import { trpcNext } from '@op/api/vanilla';

import { useTranslations } from '@/lib/i18n';

import { AllOrganizations } from '@/components/Organizations/AllOrganizations';
import {
  ListPageLayout,
  ListPageLayoutHeader,
} from '@/components/layout/ListPageLayout';

const ProfileListingPage = async () => {
  const t = useTranslations();
  
  try {
    const client = await trpcNext();
    const organizations = await client.profile.list.query({
      limit: 5,
      types: [EntityType.INDIVIDUAL],
    });

    return (
      <ListPageLayout>
        <ListPageLayoutHeader>{t('People')}</ListPageLayoutHeader>

        <AllOrganizations
          initialData={organizations}
          types={[EntityType.INDIVIDUAL]}
          limit={20}
        />
      </ListPageLayout>
    );
  } catch (error) {
    return (
      <ListPageLayout>
        <ListPageLayoutHeader>{t('People')}</ListPageLayoutHeader>

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
