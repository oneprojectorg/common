import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@op/sense/Accordion';
import { Skeleton } from '@op/sense/Skeleton';
import { Suspense } from 'react';

import ErrorBoundary from '@/components/ErrorBoundary';

import { CollectionResourcesSuspense } from './CollectionResources';

export const CollectionSection = ({
  profileId,
  collectionId,
  name,
  canManage,
}: {
  profileId: string;
  collectionId: string;
  name: string;
  canManage: boolean;
}) => {
  return (
    <AccordionItem
      value={collectionId}
      className="rounded-none border-0 bg-transparent"
    >
      <AccordionTrigger className="w-full gap-1 text-sm font-normal text-neutral-black">
        <span className="truncate">{name}</span>
      </AccordionTrigger>
      <AccordionContent>
        <div className="pt-3">
          <ErrorBoundary>
            <Suspense
              fallback={
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-24 w-full rounded-lg" />
                  <Skeleton className="h-24 w-full rounded-lg" />
                </div>
              }
            >
              <CollectionResourcesSuspense
                profileId={profileId}
                collectionId={collectionId}
                canManage={canManage}
              />
            </Suspense>
          </ErrorBoundary>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
};
