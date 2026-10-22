import type { Metadata } from 'next';

import { getTranslations } from '@/lib/i18n';

import { ProfileSearchResults } from '@/components/OrganizationsSearchResults';
import { ListPageLayout } from '@/components/layout/ListPageLayout';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return { title: t('Search') };
}

const SearchListingPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ q: string }>;
}) => {
  const { q = '' } = await searchParams;

  return (
    <ListPageLayout>
      <ProfileSearchResults query={q} />
    </ListPageLayout>
  );
};

export default SearchListingPage;
