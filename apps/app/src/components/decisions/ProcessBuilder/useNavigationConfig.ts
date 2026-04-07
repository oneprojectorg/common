'use client';

import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { trpc } from '@op/api/client';
import { useMemo } from 'react';

import {
  DEFAULT_NAVIGATION_CONFIG,
  type NavigationConfig,
} from './navigationConfig';

export function useNavigationConfig(
  instanceId: string | undefined,
): NavigationConfig {
  const { data: instance } = trpc.decision.getInstance.useQuery(
    { instanceId: instanceId! },
    { enabled: !!instanceId },
  );

  const reviewFlowEnabled = useFeatureFlag('review_flow');

  const phases = instance?.instanceData?.phases ?? [];
  const hasReviewPhase = phases.some(
    (p) => p.rules?.proposals?.review === true,
  );

  const organizeByCategories =
    instance?.instanceData?.config?.organizeByCategories ?? true;

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
