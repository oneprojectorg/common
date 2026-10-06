import { listDirectoryProfiles } from '@/server/profiles.functions';
import { PAGE_LIMIT } from '@op/common/client';
import { Header1 } from '@op/sense/Header';
import { createFileRoute } from '@tanstack/react-router';

import { pageTitle } from '@/lib/head';
import { getTranslations, useTranslations } from '@/lib/i18n';

import { AllOrganizations } from '@/components/Organizations/AllOrganizations';
import { ListPageLayout } from '@/components/layout/ListPageLayout';

export const Route = createFileRoute('/$locale/_main/org/')({
  loader: async ({ params }) => {
    const [t, organizations] = await Promise.all([
      getTranslations({ locale: params.locale }),
      listDirectoryProfiles({ data: { directory: 'organizations' } }),
    ]);

    return { title: t('Organizations'), organizations };
  },
  head: ({ loaderData }) => ({
    meta: loaderData ? [pageTitle(loaderData.title)] : [],
  }),
  component: OrgListingPage,
});

function OrgListingPage() {
  const t = useTranslations();
  const { organizations } = Route.useLoaderData();

  return (
    <ListPageLayout>
      <Header1 className="text-headline">{t('Organizations')}</Header1>
      <AllOrganizations
        initialData={organizations ?? { items: [], next: null }}
        limit={PAGE_LIMIT.md}
      />
    </ListPageLayout>
  );
}
