'use client';

import { Skeleton } from '@op/ui/Skeleton';
import { Suspense } from 'react';

import { useProcessBuilderContext } from './ProcessBuilderProvider';
import { type SectionProps, getContentComponent } from './content-registry';
import { useProcessNavigation } from './useProcessNavigation';

export function ProcessBuilderContent({
  decisionId,
  decisionName,
}: SectionProps) {
  const { navigationConfig } = useProcessBuilderContext();
  const { currentStep, currentSection } =
    useProcessNavigation(navigationConfig);

  const ContentComponent = getContentComponent(
    currentStep?.id,
    currentSection?.id,
  );

  if (!ContentComponent) {
    return <div>Section not found</div>;
  }

  return (
    <Suspense fallback={<ContentSkeleton />}>
      <ContentComponent decisionId={decisionId} decisionName={decisionName} />
    </Suspense>
  );
}

const ContentSkeleton = () => {
  return (
    <div>
      <Skeleton className="mb-4 h-5 w-64" />
      <Skeleton className="mb-6 h-3 w-44" />
      <Skeleton className="mb-2 h-3 w-94" />
      <Skeleton className="mb-2 h-3 w-74" />
    </div>
  );
};
