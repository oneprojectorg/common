'use client';

import { usePostHog } from 'posthog-js/react';
import { useCallback } from 'react';

/** Counts a partly failed batch — skipping it would bias the survey to clean runs. */
export function useTrackProfileInvited() {
  const posthog = usePostHog();

  return useCallback(
    ({
      profileId,
      invitationCount,
    }: {
      profileId: string;
      invitationCount: number;
    }) => {
      if (invitationCount === 0) {
        return;
      }

      posthog.capture('admin_invited_participants', {
        profile_id: profileId,
        invitation_count: invitationCount,
      });
    },
    [posthog],
  );
}
