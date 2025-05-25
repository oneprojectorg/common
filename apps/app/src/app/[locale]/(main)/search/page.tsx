import { OrganizationSearchResults } from '@/components/OrganizationsSearchResults';

const SearchListingPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ q: string }>;
}) => {
  const { q = '' } = await searchParams;

  return <OrganizationSearchResults query={q} />;
};

export default SearchListingPage;
