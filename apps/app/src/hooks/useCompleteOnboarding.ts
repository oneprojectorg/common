'use client';

import { trpc } from '@op/api/client';
import { logger } from '@op/logging/client';
import { usePostHog } from 'posthog-js/react';
import { useCallback } from 'react';

export function useCompleteOnboarding() {
  const posthog = usePostHog();
  const { mutateAsync } = trpc.account.completeOnboarding.useMutation();

  return useCallback(async () => {
    await mutateAsync({ tos: true, privacy: true });

    // A throw would read as a failed signup, whose retry creates a second org.
    try {
      posthog.capture('user_completed_onboarding');
    } catch (error) {
      logger.warn('Failed to report onboarding completion', { error });
    }
  }, [mutateAsync, posthog]);
}
