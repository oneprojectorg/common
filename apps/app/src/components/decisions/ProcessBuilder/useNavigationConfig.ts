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

  const storePhases = useProcessBuilderStore((s) =>
    decisionProfileId ? s.instances[decisionProfileId]?.phases : undefined,
  );

  const storeOrganizeByCategories = useProcessBuilderStore((s) =>
    decisionProfileId
      ? s.instances[decisionProfileId]?.config?.organizeByCategories
      : undefined,
  );
  const organizeByCategories =
    storeOrganizeByCategories ??
    instance?.instanceData?.config?.organizeByCategories ??
    true;

  const phases = storePhases ?? instance?.instanceData?.phases ?? [];
  const hasReviewPhase = phases.some(
    (p) => p.rules?.proposals?.review === true,
  );

  // Gate the new Overview tab behind the same flag as the participant-facing
  // overview page (decision-view layout). Drops it from the sidebar and, since
  // navigation derives from this config, redirects a direct ?section=overview.
  const overviewEnabled = useFeatureFlag('decision_overview');

  return useMemo(
    () => ({
      ...DEFAULT_NAVIGATION_CONFIG,
      steps: { ...DEFAULT_NAVIGATION_CONFIG.steps, reviews: hasReviewPhase },
      sections: {
        ...DEFAULT_NAVIGATION_CONFIG.sections,
        general: DEFAULT_NAVIGATION_CONFIG.sections?.general?.filter((s) => {
          if (s === 'proposalCategories' && !organizeByCategories) {
            return false;
          }
          if (s === 'overview' && !overviewEnabled) {
            return false;
          }
          return true;
        }),
        reviews: ['reviewSettings', 'reviewRubric'],
      },
    }),
    [hasReviewPhase, organizeByCategories, overviewEnabled],
  );
}
