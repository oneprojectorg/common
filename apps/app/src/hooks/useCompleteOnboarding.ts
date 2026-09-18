'use client';

import { trpc } from '@op/api/client';
import { logger } from '@op/logging/client';
import { usePostHog } from 'posthog-js/react';
import { useCallback } from 'react';

/**
 * Finishes onboarding and fires the browser-side `user_completed_onboarding`
 * that PostHog surveys key on. `PolicyReacceptanceModal` calls the same
 * endpoint to re-accept an updated policy and deliberately stays off this hook.
 */
export function useCompleteOnboarding() {
  const posthog = usePostHog();
  // Destructured because the mutation object is a new snapshot every render.
  const { mutateAsync } = trpc.account.completeOnboarding.useMutation();

  return useCallback(async () => {
    await mutateAsync({ tos: true, privacy: true });

    // Onboarding is already complete by here. A throw would surface to the
    // caller's catch as a failed signup, and the retry that invites would
    // create a second organization, so analytics never propagates.
    try {
      posthog.capture('user_completed_onboarding');
    } catch (error) {
      logger.warn('Failed to report onboarding completion', { error });
    }
  }, [mutateAsync, posthog]);
}
