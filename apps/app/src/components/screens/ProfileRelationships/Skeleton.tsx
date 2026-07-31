import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@op/sense/Breadcrumb';
import { Skeleton } from '@op/sense/Skeleton';
import React from 'react';

import { OrganizationCardListSkeleton } from '@/components/OrganizationList';

const BreadcrumbsSkeleton = () => (
  <div className="flex flex-col gap-4">
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbPage>
            <Skeleton className="h-4 w-20" />
          </BreadcrumbPage>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>
            <Skeleton className="h-4 w-20" />
          </BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
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
      <div className="rounded-lg border">
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
                  {/* Skeleton rows for description content */}
                  <div className="flex w-full max-w-md flex-col gap-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
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
