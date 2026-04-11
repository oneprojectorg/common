'use client';

import { useUser } from '@/utils/UserProvider';

import { useTranslations } from '@/lib/i18n';

import { type SectionProps, getContentComponentFlat } from './contentRegistry';
import { type SectionId } from './navigationConfig';
import { useNavigationConfig } from './useNavigationConfig';
import { useProcessNavigation } from './useProcessNavigation';
import { useProcessPhases } from './useProcessPhases';

export function ProcessBuilderContent({
  decisionProfileId,
  instanceId,
  decisionName,
}: SectionProps) {
  const t = useTranslations();
  const navigationConfig = useNavigationConfig(instanceId);

  const phases = useProcessPhases(instanceId, decisionProfileId);

  const { currentSection } = useProcessNavigation(navigationConfig, phases);

  const access = useUser();
  const isAdmin = access.getPermissionsForProfile(decisionProfileId).admin;

  if (!isAdmin) {
    throw new Error('UNAUTHORIZED');
  }

  const ContentComponent = getContentComponentFlat(
    currentSection?.id as SectionId | undefined,
  );

  if (!ContentComponent) {
    return <div>{t('Section not found')}</div>;
  }

  return (
    <ContentComponent
      decisionProfileId={decisionProfileId}
      instanceId={instanceId}
      decisionName={decisionName}
    />
  );
}
