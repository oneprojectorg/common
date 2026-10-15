import {
  HydrationBoundary,
  createServerUtils,
  dehydrate,
} from '@op/api/server';
import { Header1 } from '@op/sense/Header';
import type { Metadata } from 'next';
import type { SearchParams } from 'nuqs/server';

import { getTranslations } from '@/lib/i18n';

import { OrganizationsDirectory } from '@/components/Organizations/OrganizationsDirectory';
import {
  getOrganizationListInput,
  loadDirectorySearchParams,
} from '@/components/Organizations/OrganizationsDirectory/searchParams';
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
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}) => {
  const { locale } = await params;
  const [t, tOrg, filters, { utils, queryClient }] = await Promise.all([
    getTranslations({ locale }),
    getTranslations({ locale, namespace: 'org' }),
    loadDirectorySearchParams(searchParams),
    createServerUtils(),
  ]);

  const terms = await utils.organization.listFilterTerms
    .fetch()
    .catch(() => undefined);
  await utils.profile.list.prefetchInfinite(
    getOrganizationListInput(filters, terms),
  );

  return (
    <ListPageLayout>
      <div className="flex flex-col gap-3">
        <Header1 className="text-headline">{t('Organizations')}</Header1>
        <p className="text-muted-foreground">{tOrg('directorySubtitle')}</p>
      </div>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <OrganizationsDirectory />
      </HydrationBoundary>
    </ListPageLayout>
  );
};

export default OrgListingPage;
