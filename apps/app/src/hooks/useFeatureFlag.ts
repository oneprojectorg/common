import { useFeatureFlagEnabled as usePostHogFeatureFlagEnabled } from 'posthog-js/react';

/**
 * A wrapper around PostHog's `useFeatureFlagEnabled` hook.
 *
 * In development environments, this hook will **always return `true`**
 * to ensure all features are enabled for local testing.
 *
 * In production, it will behave exactly like the original PostHog hook.
 *
 * @param flag The name of the feature flag to check.
 * @returns `true` if the flag is enabled (or if in development), `false` otherwise.
 */
export function useFeatureFlagEnabled(flag: string): boolean {
  // Always return true in development to enable all features for testing
  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  // In other environments, use the real PostHog hook
  return usePostHogFeatureFlagEnabled(flag) ?? false;
}