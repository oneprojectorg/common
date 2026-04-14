import { useFeatureFlagEnabled } from 'posthog-js/react';

export const useFeatureFlag = (key: string) => {
  // enable flags for development environments
  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  return useFeatureFlagEnabled(key);
};
