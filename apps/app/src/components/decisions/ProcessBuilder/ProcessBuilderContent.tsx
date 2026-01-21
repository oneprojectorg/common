'use client';

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
    <Suspense fallback={<div>Loading...</div>}>
      <ContentComponent decisionId={decisionId} decisionName={decisionName} />
    </Suspense>
  );
}
