import { ProfileSearchResults } from '@/components/OrganizationsSearchResults';
import { ListPageLayout } from '@/components/layout/ListPageLayout';

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
