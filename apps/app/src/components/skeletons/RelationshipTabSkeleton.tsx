import { Skeleton } from '@op/ui/Skeleton';

import { OrganizationCardListSkeleton } from '@/components/OrganizationList';

/**
 * Generic skeleton for tabs displaying a title and card grid.
 * Used by Relationships, Followers, and similar tab content.
 */
export const RelationshipTabSkeleton = () => {
  return (
    <div className="gap-4 sm:gap-8 flex flex-col text-base">
      <div className="gap-4 flex flex-col">
        <Skeleton className="h-8 w-96" />
      </div>
      <OrganizationCardListSkeleton />
    </div>
  );
};
