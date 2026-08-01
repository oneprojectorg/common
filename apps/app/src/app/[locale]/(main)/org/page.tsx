import { EntityType } from '@op/api/encoders';
import { createClient } from '@op/api/serverClient';
import { Header1 } from '@op/sense/Header';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { AllOrganizations } from '@/components/Organizations/AllOrganizations';
import { ListPageLayout } from '@/components/layout/ListPageLayout';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return { title: t('Organizations') };
}

const OrgListingPage = async () => {
  try {
    const client = await createClient();
    const organizations = await client.profile.list({
      limit: 50,
      types: [EntityType.ORG],
    });

    return (
      <ListPageLayout>
        <Header1 className="text-headline">Organizations</Header1>

        <AllOrganizations initialData={organizations} limit={20} />
      </ListPageLayout>
    );
  } catch (error) {
    return (
      <ListPageLayout>
        <Header1 className="text-headline">Organizations</Header1>

        <AllOrganizations initialData={{ items: [], next: null }} limit={20} />
      </ListPageLayout>
    );
  }
};

export default OrgListingPage;
