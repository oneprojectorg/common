import { identifyUser } from '@op/analytics';
import { logger } from '@op/logging';
import type { User } from '@op/supabase/lib';
import { waitUntil } from '@vercel/functions';

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

    if (user && user.email) {
      // We are only identifying One Project users by email, matching frontend logic
      const properties: Record<string, any> = {};
      properties.authUserId = user.id;

      if (posthogSessionId) {
        properties.$session_id = posthogSessionId;
      }

      if (user.email.match(/.+@oneproject\.org$|.+@peoplepowered\.org$/)) {
        properties.email = user.email;
      }

      // Fire-and-forget so the request never inherits PostHog tail latency.
      // identifyUser now just enqueues onto the module-level batched client.
      waitUntil(
        identifyUser({
          distinctId: user.id,
          properties,
        }).catch((error) => {
          logger.error('PostHog identification failed', { error });
        }),
      );
      // For other users, we don't identify them in the backend (they get anonymous IDs on frontend)
    }
  }

  return result;
};

export default withAnalytics;
