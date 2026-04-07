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

  // Prefer the Zustand store value (written synchronously on every toggle)
  // over the tRPC query cache which may be stale until the next refetch.
  const storeInstanceData = useProcessBuilderStore((s) =>
    decisionProfileId ? s.instances[decisionProfileId] : undefined,
  );

  const reviewFlowEnabled = useFeatureFlag('review_flow');

  const phases = instance?.instanceData?.phases ?? [];
  const hasReviewPhase = phases.some(
    (p) => p.rules?.proposals?.review === true,
  );

  const organizeByCategories =
    storeInstanceData?.config?.organizeByCategories ??
    instance?.instanceData?.config?.organizeByCategories ??
    true;

  const generalSections = organizeByCategories
    ? DEFAULT_NAVIGATION_CONFIG.sections?.general
    : DEFAULT_NAVIGATION_CONFIG.sections?.general?.filter(
        (s) => s !== 'proposalCategories',
      );

  return useMemo(
    () => ({
      ...DEFAULT_NAVIGATION_CONFIG,
      steps: { ...DEFAULT_NAVIGATION_CONFIG.steps, reviews: hasReviewPhase },
      sections: {
        ...DEFAULT_NAVIGATION_CONFIG.sections,
        general: generalSections,
        reviews: reviewFlowEnabled
          ? ['reviewSettings', 'reviewRubric']
          : ['criteria'],
      },
    }),
    [hasReviewPhase, reviewFlowEnabled, generalSections],
  );
}
