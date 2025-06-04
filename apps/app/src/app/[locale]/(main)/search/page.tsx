import { OrganizationSearchResults } from '@/components/OrganizationsSearchResults';
import {
  ListPageLayout,
  ListPageLayoutHeader,
} from '@/components/layout/ListPageLayout';

const SearchListingPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ q: string }>;
}) => {
  const { q = '' } = await searchParams;

  return (
    <ListPageLayout>
      <OrganizationSearchResults query={q} />
    </ListPageLayout>
  );
};

export default SearchListingPage;
