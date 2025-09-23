'use client';

import { useUser } from '@/utils/UserProvider';
import { usePostHog } from 'posthog-js/react';
import { useEffect } from 'react';

interface ProcessViewTrackerProps {
  processInstanceId: string;
}

export function ProcessViewTracker({
  processInstanceId,
}: ProcessViewTrackerProps) {
  const { user } = useUser();
  const posthog = usePostHog();

  useEffect(() => {
    if (!user || !posthog) return;

    // Track process viewed event
    posthog.capture('process_viewed', {
      distinctId: user.id,
      process_id: processInstanceId,
      user_id: user.id,
      location: window.location.href,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
      timestamp: new Date().toISOString(),
    });
  }, [user, posthog, processInstanceId]);

  return null;
}
