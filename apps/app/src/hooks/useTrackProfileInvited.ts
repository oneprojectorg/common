'use client';

import { usePostHog } from 'posthog-js/react';
import { useCallback } from 'react';

/**
 * Browser-side mirror of the server's `admin_invited_participants`, for every
 * client caller of `profile.invite`.
 *
 * Gated on the same predicate as the server: a batch where one invite bounced
 * still invited everyone else, so reporting only clean batches would bias the
 * survey away from exactly the admins who hit friction.
 */
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
