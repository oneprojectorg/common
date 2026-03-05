'use client';

import { trpc } from '@op/api/client';
import { useMemo } from 'react';

import { useUser } from '@/utils/UserProvider';

import { useTranslations } from '@/lib/i18n';

import { type SectionProps, getContentComponentFlat } from './contentRegistry';
import { type SectionId } from './navigationConfig';
import { useProcessBuilderStore } from './stores/useProcessBuilderStore';
import { useNavigationConfig } from './useNavigationConfig';
import { useProcessNavigation } from './useProcessNavigation';

export function ProcessBuilderContent({
  decisionProfileId,
  instanceId,
  decisionName,
}: SectionProps) {
  const t = useTranslations();
  const navigationConfig = useNavigationConfig(instanceId);

  const storePhases = useProcessBuilderStore((s) =>
    decisionProfileId ? s.instances[decisionProfileId]?.phases : undefined,
  );

  const { data: instance } = trpc.decision.getInstance.useQuery(
    { instanceId },
    { enabled: !!instanceId },
  );

  const phases = useMemo(() => {
    if (storePhases?.length) {
      return storePhases
        .map((p) => ({ phaseId: p.phaseId, name: p.name ?? '' }))
        .filter((p) => p.name);
    }
    const instancePhases = instance?.instanceData?.phases;
    if (instancePhases?.length) {
      return instancePhases
        .map((p) => ({ phaseId: p.phaseId, name: p.name ?? '' }))
        .filter((p) => p.name);
    }
    const templatePhases = instance?.process?.processSchema?.phases;
    if (templatePhases?.length) {
      return templatePhases.map((p) => ({ phaseId: p.id, name: p.name }));
    }
    return [];
  }, [storePhases, instance]);

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
