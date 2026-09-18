'use client';

import type { RouterInput } from '@op/api/client';
import { usePostHog } from 'posthog-js/react';
import { useCallback } from 'react';

type InviteInput = RouterInput['organization']['invite'];

/**
 * Browser-side mirror of the server's `user_invited`, for every client caller of
 * `organization.invite`.
 *
 * Properties come from the mutation's `variables` rather than component state:
 * the invite modal stays mounted across a tab or profile switch, so state read
 * at response time can name a different organization than the one invited to.
 * Only an invite into an existing organization carries `organization_id`, which
 * is how the server distinguishes its two branches too.
 */
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
