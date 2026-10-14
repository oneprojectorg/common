import { EntityType } from '@op/api/encoders';
import { createClient } from '@op/api/serverClient';
import { PAGE_LIMIT } from '@op/common/client';
import { logger } from '@op/logging';
import { Header1 } from '@op/sense/Header';
import type { Metadata } from 'next';

import { getTranslations } from '@/lib/i18n';

import { OrganizationsDirectory } from '@/components/Organizations/OrganizationsDirectory';
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

  // First page of the default view (Newest, no filters); the client fetches
  // anything else. If this fails the client fetches it too.
  const organizations = await createClient()
    .then((client) =>
      client.profile.list({
        limit: PAGE_LIMIT.md,
        types: [EntityType.ORG],
        orderBy: 'createdAt',
        dir: 'desc',
      }),
    )
    .catch((error: unknown) => {
      // Expected for a signed-out request, which the layout then redirects.
      logger.warn('Organizations prefetch failed', { error });
      return undefined;
    });

  return (
    <ListPageLayout>
      <div className="flex flex-col gap-3">
        <Header1 className="text-headline">{t('Organizations')}</Header1>
        <p className="text-muted-foreground">{t('org.directorySubtitle')}</p>
      </div>
      <OrganizationsDirectory initialData={organizations} />
    </ListPageLayout>
  );
};

export default OrgListingPage;
