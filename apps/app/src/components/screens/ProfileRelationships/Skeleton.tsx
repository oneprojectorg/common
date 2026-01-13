import { Breadcrumb, Breadcrumbs } from '@op/ui/Breadcrumbs';
import { Skeleton, SkeletonLine } from '@op/ui/Skeleton';
import React from 'react';

import { OrganizationCardListSkeleton } from '@/components/OrganizationList';

const BreadcrumbsSkeleton = () => (
  <div className="flex flex-col gap-4">
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
  <li className="flex w-full gap-6">
    <div className="shrink-0">
      <Skeleton className="size-12 rounded-full" />
    </div>
    <div className="flex w-full flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-5 w-40" />
        <div className="flex items-center gap-1">
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <Skeleton className="h-4 w-3/4" />
    </div>
  </li>
);

const RelationshipListSkeleton = () => (
  <ul className="flex flex-col gap-12">
    {Array.from({ length: 3 }).map((_, index) => (
      <RelationshipItemSkeleton key={index} />
    ))}
  </ul>
);

export const ProfileRelationshipsSkeleton = () => {
  return (
    <>
      <div className="flex flex-col gap-4">
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
      <div className="flex flex-col gap-4">
        <BreadcrumbsSkeleton />
        <TitleSkeleton />
      </div>
      <div className="rounded-md border">
        <TabListSkeleton />
        <div className="px-6 py-4">
          <ul className="flex flex-col gap-12">
            {Array.from({ length: 3 }).map((_, index) => (
              <li key={index} className="flex w-full gap-6">
                <div className="shrink-0">
                  <Skeleton className="size-12 rounded-full" />
                </div>
                <div className="flex w-full flex-col gap-3">
                  <div className="flex flex-col gap-2">
                    <Skeleton className="h-5 w-40" />
                    <div className="flex items-center gap-1">
                      <Skeleton className="h-4 w-32" />
                    </div>
                  </div>
                  {/* Using SkeletonLine for description content */}
                  <SkeletonLine
                    lines={2}
                    randomWidth={true}
                    className="w-full max-w-md"
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
      <div className="flex flex-col gap-4">
        <BreadcrumbsSkeleton />
        <TitleSkeleton />
      </div>
      <OrganizationCardListSkeleton />
    </>
  );
};
