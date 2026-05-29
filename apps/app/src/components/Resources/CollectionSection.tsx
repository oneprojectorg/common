import {
  AccordionContent,
  AccordionIndicator,
  AccordionItem,
  AccordionTrigger,
} from '@op/ui/Accordion';
import { Skeleton } from '@op/ui/Skeleton';
import { Suspense } from 'react';

import ErrorBoundary from '@/components/ErrorBoundary';

import { CollectionResourcesSuspense } from './CollectionResources';

export const CollectionSection = ({
  collectionId,
  name,
  canManage,
}: {
  collectionId: string;
  name: string;
  canManage: boolean;
}) => {
  return (
    <AccordionItem id={collectionId} variant="unstyled">
      <AccordionTrigger className="flex w-full cursor-pointer items-center gap-1 text-start text-sm text-neutral-black outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1">
        <AccordionIndicator className="text-neutral-black" />
        <span className="truncate">{name}</span>
      </AccordionTrigger>
      <AccordionContent className="overflow-hidden">
        <div className="pt-4">
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
