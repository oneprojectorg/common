import { OrganizationSearchResults } from '@/components/OrganizationsSearchResults';

const SearchListingPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ q: string }>;
}) => {
  const { q = '' } = await searchParams;

  return (
    <div className="flex w-full flex-col gap-3 pt-8 sm:min-h-[calc(100vh-3.5rem)] sm:gap-6">
      <div className="flex flex-col gap-4 px-4 sm:px-0">
        <div className="font-serif text-title-lg text-neutral-gray4">
          Results for <span className="text-neutral-black">{q}</span>
        </div>
      </div>
      <OrganizationSearchResults query={q} />
    </div>
  );
};

export default SearchListingPage;
