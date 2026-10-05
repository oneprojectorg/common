import { getDecisionCommonProperties } from '@op/analytics/client-utils';
import type { RouterInput, RouterOutput } from '@op/api/client';
import posthog from 'posthog-js';

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

  posthog.capture('user_invited_client', {
    invite_count: inviteCount,
    ...(organizationId && { organization_id: organizationId }),
  });
};

export const trackProfileInvited = (
  result: RouterOutput['profile']['invite'],
  variables: RouterInput['profile']['invite'],
) => {
  if (result.details.successful.length === 0) {
    return;
  }

  const properties = {
    profile_id: variables.profileId,
    invitation_count: result.details.successful.length,
  };

  posthog.capture(
    'admin_invited_participants_client',
    result.processId
      ? getDecisionCommonProperties({
          decisionInstanceId: result.processId,
          additionalProps: properties,
        })
      : properties,
  );
};
