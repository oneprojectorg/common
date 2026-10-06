import { createFileRoute } from '@tanstack/react-router';

import { pageTitle } from '@/lib/head';
import { getTranslations } from '@/lib/i18n';
import { useSearchParams } from '@/lib/navigation';

import { ProfileSearchResults } from '@/components/OrganizationsSearchResults';
import { ListPageLayout } from '@/components/layout/ListPageLayout';

export const Route = createFileRoute('/$locale/_main/search/')({
  loader: async ({ params }) => {
    const t = await getTranslations({ locale: params.locale });

    return { title: t('Search') };
  },
  head: ({ loaderData }) => ({
    meta: loaderData ? [pageTitle(loaderData.title)] : [],
  }),
  component: SearchListingPage,
});

function SearchListingPage() {
  const query = useSearchParams().get('q') ?? '';

  return (
    <ListPageLayout>
      <ProfileSearchResults query={query} />
    </ListPageLayout>
  );
}
