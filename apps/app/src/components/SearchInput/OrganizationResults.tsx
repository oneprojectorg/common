import { Organization } from '@op/api/encoders';

import { Link } from '@/lib/i18n';

import { OrganizationAvatar } from '../OrganizationAvatar';
import { SearchResultItem } from './SearchResultItem';

interface OrganizationResultsProps {
  query: string;
  organizationResults: Array<Organization>;
  selectedIndex: number;
  onSearch: (query: string) => void;
}

export const OrganizationResults = ({
  query,
  organizationResults,
  selectedIndex,
  onSearch,
}: OrganizationResultsProps) => {
  return (
    <div className="pb-4">
      {organizationResults.map((org, index) => (
        <SearchResultItem key={org.id} selected={selectedIndex === index + 1}>
          <Link
            className="group/result flex w-full items-center gap-4 hover:no-underline"
            href={`/org/${org.profile.slug}`}
            onClick={() => onSearch(query)}
          >
            <OrganizationAvatar
              organization={org}
              withLink={false}
              className="size-8 group-hover/result:no-underline"
            />

            <div className="flex flex-col font-semibold text-neutral-charcoal group-hover/result:underline">
              <span>{org.profile.name}</span>
              <span>{org.profile.city}</span>
            </div>
          </Link>
        </SearchResultItem>
      ))}
    </div>
  );
};
