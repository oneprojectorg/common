'use client';

import { useUser } from '@/utils/UserProvider';

import { getContentComponent } from './contentRegistry';
import { type NavigationConfig } from './navigationConfig';
import { useProcessNavigation } from './useProcessNavigation';

export function ProcessBuilderContent({
  decisionProfileId,
  instanceId,
  decisionName,
  navigationConfig,
}: {
  decisionProfileId: string;
  decisionName: string;
  navigationConfig?: NavigationConfig;
}) {
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
      instanceId={instanceId}
      decisionName={decisionName}
    />
  );
}
