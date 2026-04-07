'use client';

import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { trpc } from '@op/api/client';
import { useMemo } from 'react';

import {
  DEFAULT_NAVIGATION_CONFIG,
  type NavigationConfig,
} from './navigationConfig';
import { useProcessBuilderStore } from './stores/useProcessBuilderStore';

export function useNavigationConfig(
  instanceId: string | undefined,
  decisionProfileId?: string,
): NavigationConfig {
  const { data: instance } = trpc.decision.getInstance.useQuery(
    { instanceId: instanceId! },
    { enabled: !!instanceId },
  );

  const reviewFlowEnabled = useFeatureFlag('review_flow');
  const storeOrganizeByCategories = useProcessBuilderStore((s) =>
    decisionProfileId
      ? s.instances[decisionProfileId]?.config?.organizeByCategories
      : undefined,
  );
  const organizeByCategories =
    storeOrganizeByCategories ??
    instance?.instanceData?.config?.organizeByCategories ??
    true;

  const phases = instance?.instanceData?.phases ?? [];
  const hasReviewPhase = phases.some(
    (p) => p.rules?.proposals?.review === true,
  );

  return useMemo(
    () => ({
      ...DEFAULT_NAVIGATION_CONFIG,
      steps: { ...DEFAULT_NAVIGATION_CONFIG.steps, reviews: hasReviewPhase },
      sections: {
        ...DEFAULT_NAVIGATION_CONFIG.sections,
        general: organizeByCategories
          ? DEFAULT_NAVIGATION_CONFIG.sections?.general
          : DEFAULT_NAVIGATION_CONFIG.sections?.general?.filter(
              (s) => s !== 'proposalCategories',
            ),
        reviews: reviewFlowEnabled
          ? ['reviewSettings', 'reviewRubric']
          : ['criteria'],
      },
    }),
    [hasReviewPhase, reviewFlowEnabled, organizeByCategories],
  );
}
