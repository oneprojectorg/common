import { areFeatureFlagsForcedOn } from '@op/analytics/client-utils';
import { useFeatureFlagEnabled } from 'posthog-js/react';

export const useFeatureFlag = (key: string) => {
  // Asked before the environment check, because an early return would call a
  // hook on some renders and not others.
  const enabled = useFeatureFlagEnabled(key);

  return areFeatureFlagsForcedOn() ? true : enabled;
};
