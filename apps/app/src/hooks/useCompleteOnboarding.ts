'use client';

import { trpc } from '@op/api/client';
import { logger } from '@op/logging/client';
import { usePostHog } from 'posthog-js/react';
import { useCallback } from 'react';

/** `PolicyReacceptanceModal` reuses this endpoint and deliberately stays off here. */
export function useCompleteOnboarding() {
  const posthog = usePostHog();
  // Destructured because the mutation object is a new snapshot every render.
  const { mutateAsync } = trpc.account.completeOnboarding.useMutation();

  return useCallback(async () => {
    await mutateAsync({ tos: true, privacy: true });

    // Onboarding already succeeded; a throw would reach the caller's catch as a
    // failed signup, whose retry creates a second organization.
    try {
      posthog.capture('user_completed_onboarding');
    } catch (error) {
      logger.warn('Failed to report onboarding completion', { error });
    }
  }, [mutateAsync, posthog]);
}
