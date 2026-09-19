import type { RouterInput, RouterOutput } from '@op/api/client';
import posthog from 'posthog-js';

/**
 * Only an invite into an existing organization carries `organization_id`, which
 * is how the server distinguishes its two branches too.
 */
export const trackUserInvited = ({
  organizationId,
  inviteCount,
}: {
  organizationId?: string;
  inviteCount: number;
}) => {
  if (inviteCount === 0) {
    return;
  }

  posthog.capture('user_invited', {
    invite_count: inviteCount,
    ...(organizationId && { organization_id: organizationId }),
  });
};

/**
 * Shaped as a react-query `onSuccess` so both invite modals can pass it
 * straight through. Counts a partly failed batch — skipping it would bias the
 * survey to clean runs.
 */
export const trackProfileInvited = (
  result: RouterOutput['profile']['invite'],
  variables: RouterInput['profile']['invite'],
) => {
  if (result.details.successful.length === 0) {
    return;
  }

  posthog.capture('admin_invited_participants', {
    profile_id: variables.profileId,
    invitation_count: result.details.successful.length,
  });
};
