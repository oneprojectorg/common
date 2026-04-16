import { useFeatureFlagEnabled } from 'posthog-js/react';

export const useFeatureFlag = (key: string) => {
  // enable flags for development and e2e environments
  if (
    process.env.NODE_ENV === 'development' ||
    process.env.NEXT_PUBLIC_E2E === 'true'
  ) {
    return true;
  }

  return useFeatureFlagEnabled(key);
};
