'use client';

import { getDecisionCommonProperties } from '@op/analytics/client-utils';
import type { RouterInput } from '@op/api/client';
import { usePostHog } from 'posthog-js/react';
import { useCallback, useRef } from 'react';

import { hasRubricChange } from './rubricSaved';

type UpdateInstanceInput = RouterInput['decision']['updateDecisionInstance'];

/**
 * Fires once per process, not once per write: the rubric editor autosaves on a
 * 1s debounce, so a per-write event would pop the survey mid-keystroke.
 */
export function useTrackRubricSaved(instanceId: string) {
  const posthog = usePostHog();
  const trackedInstanceId = useRef<string | null>(null);

  return useCallback(
    (variables: UpdateInstanceInput) => {
      if (
        trackedInstanceId.current === instanceId ||
        !hasRubricChange(variables)
      ) {
        return;
      }
      trackedInstanceId.current = instanceId;

      posthog.capture(
        'admin_set_rubric',
        getDecisionCommonProperties({ decisionInstanceId: instanceId }),
      );
    },
    [posthog, instanceId],
  );
}
