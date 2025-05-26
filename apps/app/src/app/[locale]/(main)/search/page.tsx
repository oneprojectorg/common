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
      <ListPageLayoutHeader>
        Results for <span className="text-neutral-black">{q}</span>
      </ListPageLayoutHeader>
      <OrganizationSearchResults query={q} />
    </ListPageLayout>
  );
};

export default SearchListingPage;
