import { Breadcrumb, Breadcrumbs } from '@op/ui/Breadcrumbs';
import { Skeleton, SkeletonLine } from '@op/ui/Skeleton';
import React from 'react';

import { OrganizationCardListSkeleton } from '@/components/OrganizationList';

const BreadcrumbsSkeleton = () => (
  <div className="gap-4 flex flex-col">
    <Breadcrumbs>
      <Breadcrumb>
        <Skeleton className="w-20" />
      </Breadcrumb>
      <Breadcrumb>
        <Skeleton className="w-20" />
      </Breadcrumb>
    </Breadcrumbs>
  </div>
);

const TitleSkeleton = () => <Skeleton className="h-8 w-96" />;

const TabListSkeleton = () => (
  <div className="px-4">
    <Skeleton className="h-10 w-40 rounded" />
  </div>
);

const RelationshipItemSkeleton = () => (
  <li className="gap-6 flex w-full">
    <div className="shrink-0">
      <Skeleton className="size-12 rounded-full" />
    </div>
    <div className="gap-3 flex w-full flex-col">
      <div className="gap-2 flex flex-col">
        <Skeleton className="h-5 w-40" />
        <div className="gap-1 flex items-center">
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <Skeleton className="h-4 w-3/4" />
    </div>
  </li>
);

const RelationshipListSkeleton = () => (
  <ul className="gap-12 flex flex-col">
    {Array.from({ length: 3 }).map((_, index) => (
      <RelationshipItemSkeleton key={index} />
    ))}
  </ul>
);

export const ProfileRelationshipsSkeleton = () => {
  return (
    <>
      <div className="gap-4 flex flex-col">
        <BreadcrumbsSkeleton />
        <TitleSkeleton />
      </div>
      <div>
        <TabListSkeleton />
        <div className="px-6 py-4">
          <RelationshipListSkeleton />
        </div>
      </div>
    </>
  );
};

export const ProfileRelationshipsSkeletonWithLines = () => {
  return (
    <>
      <div className="gap-4 flex flex-col">
        <BreadcrumbsSkeleton />
        <TitleSkeleton />
      </div>
      <div className="rounded-md border border-neutral-gray1">
        <TabListSkeleton />
        <div className="px-6 py-4">
          <ul className="gap-12 flex flex-col">
            {Array.from({ length: 3 }).map((_, index) => (
              <li key={index} className="gap-6 flex w-full">
                <div className="shrink-0">
                  <Skeleton className="size-12 rounded-full" />
                </div>
                <div className="gap-3 flex w-full flex-col">
                  <div className="gap-2 flex flex-col">
                    <Skeleton className="h-5 w-40" />
                    <div className="gap-1 flex items-center">
                      <Skeleton className="h-4 w-32" />
                    </div>
                  </div>
                  {/* Using SkeletonLine for description content */}
                  <SkeletonLine
                    lines={2}
                    randomWidth={true}
                    className="max-w-md w-full"
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
};

export const ProfileOrganizationsSkeleton = () => {
  return (
    <>
      <div className="gap-4 flex flex-col">
        <BreadcrumbsSkeleton />
        <TitleSkeleton />
      </div>
      <OrganizationCardListSkeleton />
    </>
  );
};
