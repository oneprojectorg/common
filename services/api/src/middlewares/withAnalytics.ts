import { identifyUser } from '@op/analytics';
import type { User } from '@op/supabase/lib';

import type { MiddlewareBuilderBase, TContextWithAnalytics } from '../types';

const withAnalytics: MiddlewareBuilderBase<TContextWithAnalytics> = async ({
  ctx,
  next,
}) => {
  const result = await next({
    ctx: {
      ...ctx,
      analyticsDistinctId: undefined,
    },
  });

  if (result.ok) {
    const user = (ctx as any).user as User;
    const posthogSessionId = ctx.req.headers.get('x-posthog-session-id');
    console.log('IDENTIFY posthogSessionId', posthogSessionId, user, 'here');

    if (user && user.email) {
      try {
        // We are only identifying One Project users by email, matching frontend logic
        const properties: Record<string, any> = {};

        if (posthogSessionId) {
          properties.$session_id = posthogSessionId;
        }

        if (user.email.match(/.+@oneproject\.org$|.+@peoplepowered\.org$/)) {
          properties.email = user.email;
        }

        await identifyUser({
          distinctId: user.id,
          properties,
        });
        // For other users, we don't identify them in the backend (they get anonymous IDs on frontend)
      } catch (error) {
        // Don't fail the request if PostHog identification fails
        console.error('PostHog identification failed:', error);
      }
    }
  }

  return result;
};

export default withAnalytics;
