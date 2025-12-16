import { Skeleton } from '@op/ui/Skeleton';

import { OrganizationCardListSkeleton } from '@/components/OrganizationList';

/**
 * Generic skeleton for tabs displaying a title and card grid.
 * Used by Relationships, Followers, and similar tab content.
 */
export const RelationshipTabSkeleton = () => {
  return (
    <div className="flex flex-col gap-4 text-base sm:gap-8">
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-96" />
      </div>
      <OrganizationCardListSkeleton />
    </div>
  );
};
