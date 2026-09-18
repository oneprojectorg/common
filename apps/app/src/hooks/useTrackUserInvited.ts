'use client';

import type { RouterInput } from '@op/api/client';
import { usePostHog } from 'posthog-js/react';
import { useCallback } from 'react';

type InviteInput = RouterInput['organization']['invite'];

/** Reads `variables`, not state — the modal survives a profile switch mid-request. */
export function useTrackUserInvited() {
  const posthog = usePostHog();

  return useCallback(
    ({
      variables,
      inviteCount,
    }: {
      variables: InviteInput;
      inviteCount: number;
    }) => {
      if (inviteCount === 0) {
        return;
      }

      posthog.capture('user_invited', {
        invite_count: inviteCount,
        ...(variables.organizationId && {
          organization_id: variables.organizationId,
        }),
      });
    },
    [posthog],
  );
}
