'use client';

import { useTranslations } from '@/lib/i18n';

import { AccessBoundary } from '@/components/AccessBoundary';

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
  const navigationConfig = useNavigationConfig(instanceId, decisionProfileId);

  const phases = useProcessPhases(instanceId, decisionProfileId);

  const { currentSection } = useProcessNavigation(navigationConfig, phases);

  const ContentComponent = getContentComponentFlat(
    currentSection?.id as SectionId | undefined,
  );

  return (
    <AccessBoundary
      required={{ decisions: { admin: true } }}
      // required={{ profile: { admin: true } }}
      profileId={decisionProfileId}
      fallback={<ThrowUnauthorized />}
    >
      {ContentComponent ? (
        <ContentComponent
          decisionProfileId={decisionProfileId}
          instanceId={instanceId}
          decisionName={decisionName}
        />
      ) : (
        <div>{t('Section not found')}</div>
      )}
    </AccessBoundary>
  );
}

function ThrowUnauthorized(): never {
  throw new Error('UNAUTHORIZED');
}
