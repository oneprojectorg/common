import { listDirectoryProfiles } from '@/server/profiles.functions';
import { EntityType } from '@op/api/encoders';
import { PAGE_LIMIT } from '@op/common/client';
import { Header1 } from '@op/sense/Header';
import { createFileRoute } from '@tanstack/react-router';

import { pageTitle } from '@/lib/head';
import { getTranslations, useTranslations } from '@/lib/i18n';

import { AllOrganizations } from '@/components/Organizations/AllOrganizations';
import { ListPageLayout } from '@/components/layout/ListPageLayout';

export const Route = createFileRoute('/$locale/_main/profile/')({
  loader: async ({ params }) => {
    const [t, people] = await Promise.all([
      getTranslations({ locale: params.locale }),
      listDirectoryProfiles({ data: { directory: 'people' } }),
    ]);

    return { title: t('shell.peopleNavTitle'), people };
  },
  head: ({ loaderData }) => ({
    meta: loaderData ? [pageTitle(loaderData.title)] : [],
  }),
  component: ProfileListingPage,
});

function ProfileListingPage() {
  const t = useTranslations();
  const { people } = Route.useLoaderData();

  return (
    <ListPageLayout>
      <Header1 className="text-headline">{t('shell.peopleNavTitle')}</Header1>
      {people ? (
        <AllOrganizations
          initialData={people}
          types={[EntityType.INDIVIDUAL]}
          limit={PAGE_LIMIT.md}
        />
      ) : (
        <AllOrganizations
          initialData={{ items: [], next: null }}
          types={[EntityType.USER]}
          limit={PAGE_LIMIT.md}
        />
      )}
    </ListPageLayout>
  );
}
