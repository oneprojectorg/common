import { getDecisionCommonProperties } from '@op/analytics/client-utils';
import posthog from 'posthog-js';

export const trackRubricSaved = (instanceId: string) =>
  posthog.capture(
    'rubric_save_confirmed',
    getDecisionCommonProperties({ decisionInstanceId: instanceId }),
  );
