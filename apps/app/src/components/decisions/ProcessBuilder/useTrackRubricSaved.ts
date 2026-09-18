'use client';

import { getDecisionCommonProperties } from '@op/analytics/client-utils';
import type { RouterInput } from '@op/api/client';
import { usePostHog } from 'posthog-js/react';
import { useCallback, useRef } from 'react';

import { hasRubricChange } from './rubricSaved';

type UpdateInstanceInput = RouterInput['decision']['updateDecisionInstance'];

/**
 * Browser-side mirror of the server's `admin_set_rubric`, for both process
 * builder write paths: the draft autosave and the published "Update Process"
 * button. Pass the mutation's `variables`.
 *
 * Fires once per editing session rather than once per write. The rubric editor
 * autosaves on a 1s debounce, so the server's per-write event lands dozens of
 * times while an admin types a criterion — fine for a counter, wrong for the
 * survey trigger this exists to serve, which would pop mid-keystroke.
 */
export function useTrackRubricSaved(instanceId: string) {
  const posthog = usePostHog();
  // Keyed by instance, not a bare flag: the ref outlives a prop change, so a
  // host reconciled onto a different process would otherwise swallow its first
  // rubric save.
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
