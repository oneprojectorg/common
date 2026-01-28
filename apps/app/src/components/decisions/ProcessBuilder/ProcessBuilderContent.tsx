'use client';

import { useUser } from '@/utils/UserProvider';

import { type SectionProps, getContentComponent } from './contentRegistry';
import { type NavigationConfig } from './navigationConfig';
import { useProcessNavigation } from './useProcessNavigation';

export function ProcessBuilderContent({
  decisionProfileId,
  decisionName,
  navigationConfig,
}: SectionProps & { navigationConfig?: NavigationConfig }) {
  const { currentStep, currentSection } =
    useProcessNavigation(navigationConfig);

  const access = useUser();
  const isAdmin = access.getPermissionsForProfile(decisionProfileId).admin;

  if (!isAdmin) {
    throw new Error('UNAUTHORIZED');
  }

  const ContentComponent = getContentComponent(
    currentStep?.id,
    currentSection?.id,
  );

  if (!ContentComponent) {
    return <div>Section not found</div>;
  }

  return (
    <ContentComponent
      decisionProfileId={decisionProfileId}
      decisionName={decisionName}
    />
  );
}
