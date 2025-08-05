import { EntityType } from '@op/api/encoders';
import { trpcNext } from '@op/api/vanilla';

import { useTranslations } from '@/lib/i18n';

import { AllOrganizations } from '@/components/Organizations/AllOrganizations';
import {
  ListPageLayout,
  ListPageLayoutHeader,
} from '@/components/layout/ListPageLayout';

const OrgListingPage = async () => {
  const t = useTranslations();
  
  try {
    const client = await trpcNext();
    const organizations = await client.profile.list.query({
      limit: 50,
      types: [EntityType.ORG],
    });

    return (
      <ListPageLayout>
        <ListPageLayoutHeader>{t('Organizations')}</ListPageLayoutHeader>

        <AllOrganizations initialData={organizations} limit={20} />
      </ListPageLayout>
    );
  } catch (error) {
    return (
      <ListPageLayout>
        <ListPageLayoutHeader>{t('Organizations')}</ListPageLayoutHeader>

        <AllOrganizations
          initialData={{ items: [], hasMore: false, next: null }}
          limit={20}
        />
      </ListPageLayout>
    );
  }
};

export default OrgListingPage;
