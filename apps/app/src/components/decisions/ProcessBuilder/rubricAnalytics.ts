import { getDecisionCommonProperties } from '@op/analytics/client-utils';
import posthog from 'posthog-js';

export const trackRubricSaved = (instanceId: string) =>
  posthog.capture(
    'admin_set_rubric',
    getDecisionCommonProperties({ decisionInstanceId: instanceId }),
  );
