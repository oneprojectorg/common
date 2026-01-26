'use client';

import { type SectionProps, getContentComponent } from './contentRegistry';
import { type NavigationConfig } from './navigationConfig';
import { useProcessNavigation } from './useProcessNavigation';

export function ProcessBuilderContent({
  decisionId,
  decisionName,
  navigationConfig,
}: SectionProps & { navigationConfig?: NavigationConfig }) {
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
    <ContentComponent decisionId={decisionId} decisionName={decisionName} />
  );
}
