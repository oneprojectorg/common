'use client';

import { trpc } from '@op/api/client';

import { useTranslations } from '@/lib/i18n';

import { type SectionProps, getContentComponentFlat } from './contentRegistry';
import { type SectionId } from './navigationConfig';
import { useNavigationConfig } from './useNavigationConfig';
import { useProcessNavigation } from './useProcessNavigation';
import { useProcessPhases } from './useProcessPhases';

interface ProcessBuilderContentProps extends SectionProps {
  slug: string;
}

export function ProcessBuilderContent({
  decisionProfileId,
  instanceId,
  decisionName,
  slug,
}: ProcessBuilderContentProps) {
  const t = useTranslations();
  const navigationConfig = useNavigationConfig(instanceId, decisionProfileId);

  const phases = useProcessPhases(instanceId, decisionProfileId);

  const { currentSection } = useProcessNavigation(navigationConfig, phases);

  const { data: decisionProfile } = trpc.decision.getDecisionBySlug.useQuery({
    slug,
  });

  if (decisionProfile && !decisionProfile.processInstance.access?.admin) {
    throw new Error('UNAUTHORIZED');
  }

  const ContentComponent = getContentComponentFlat(
    currentSection?.id as SectionId | undefined,
  );

  return ContentComponent ? (
    <ContentComponent
      decisionProfileId={decisionProfileId}
      instanceId={instanceId}
      decisionName={decisionName}
    />
  ) : (
    <div>{t('Section not found')}</div>
  );
}
