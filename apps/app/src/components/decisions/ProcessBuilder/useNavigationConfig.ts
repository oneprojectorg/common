'use client';

import { useMemo } from 'react';

import { trpc } from '@op/api/client';

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

  const phases = instance?.instanceData?.phases ?? [];
  const hasReviewPhase = phases.some(
    (p) => p.rules?.proposals?.review === true,
  );

  return useMemo(
    () => ({
      ...DEFAULT_NAVIGATION_CONFIG,
      steps: { ...DEFAULT_NAVIGATION_CONFIG.steps, rubric: hasReviewPhase },
    }),
    [hasReviewPhase],
  );
}
