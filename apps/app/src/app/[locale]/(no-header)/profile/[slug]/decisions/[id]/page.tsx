import { Skeleton } from '@op/ui/Skeleton';
import { Suspense } from 'react';

import { DecisionHeader } from '@/components/decisions/DecisionHeader';
import { DecisionStateRouter } from '@/components/decisions/DecisionStateRouter';

function DecisionHeaderSkeleton() {
  return (
    <div className="border-b bg-neutral-offWhite">
      {/* Header skeleton */}
      <div className="flex items-center justify-between border-b border-neutral-gray1 bg-white px-6 py-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>

      {/* Stepper skeleton */}
      <div className="flex flex-col overflow-x-auto sm:items-center">
        <div className="w-fit rounded-b border border-t-0 bg-white px-12 py-4 sm:px-32">
          <div className="mx-auto flex items-center justify-center space-x-8">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex flex-col items-center">
                <Skeleton className="h-10 w-10 rounded-full" />
                <Skeleton className="mt-3 h-4 w-24" />
                <Skeleton className="mt-1 h-3 w-16" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const DecisionInstancePageContent = ({
  instanceId,
  slug,
}: {
  instanceId: string;
  slug: string;
}) => {
  return (
    <Suspense fallback={<DecisionHeaderSkeleton />}>
      <DecisionHeader instanceId={instanceId} slug={slug}>
        <Suspense fallback={<Skeleton className="h-96" />}>
          <DecisionStateRouter instanceId={instanceId} slug={slug} />
        </Suspense>
      </DecisionHeader>
    </Suspense>
  );
};

const DecisionInstancePage = async ({
  params,
}: {
  params: Promise<{ id: string; slug: string }>;
}) => {
  const { id, slug } = await params;

  return <DecisionInstancePageContent instanceId={id} slug={slug} />;
};

export default DecisionInstancePage;
