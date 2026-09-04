import { EntityType } from '@op/api/encoders';
import { createClient } from '@op/api/serverClient';
import { PAGE_LIMIT } from '@op/common/client';
import { Header1 } from '@op/sense/Header';
import type { Metadata } from 'next';

import { getTranslations } from '@/lib/i18n';

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

const OrgListingPage = async ({
  params,
}: {
  params: Promise<{ locale: string }>;
}) => {
  const { locale } = await params;
  const t = await getTranslations({ locale });

  try {
    const client = await createClient();
    const organizations = await client.profile.list({
      limit: PAGE_LIMIT.lg,
      types: [EntityType.ORG],
    });

    return (
      <ListPageLayout>
        <Header1 className="text-headline">{t('Organizations')}</Header1>
        <AllOrganizations initialData={organizations} limit={PAGE_LIMIT.md} />
      </ListPageLayout>
    );
  } catch (error) {
    return (
      <ListPageLayout>
        <Header1 className="text-headline">{t('Organizations')}</Header1>
        <AllOrganizations
          initialData={{ items: [], next: null }}
          limit={PAGE_LIMIT.md}
        />
      </ListPageLayout>
    );
  }
};

export default OrgListingPage;
