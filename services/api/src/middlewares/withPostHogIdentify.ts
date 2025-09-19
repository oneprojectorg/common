import { identifyUser } from '@op/analytics';
import type { User } from '@op/supabase/lib';

import type { MiddlewareBuilderBase, TContextWithAnalytics } from '../types';

const withPostHogIdentify: MiddlewareBuilderBase<
  TContextWithAnalytics
> = async ({ ctx, next }) => {
  const posthogDistinctId = ctx.req.headers.get('x-posthog-distinct-id');

  const result = await next({
    ctx: {
      ...ctx,
      analyticsDistinctId: posthogDistinctId || undefined,
    },
  });

  if (result.ok) {
    const user = (ctx as any).user as User;
    const posthogSessionId = ctx.req.headers.get('x-posthog-session-id');

    if (posthogDistinctId && (posthogSessionId || user)) {
      try {
        // Identify user with PostHog using the client's distinct ID
        const properties: Record<string, any> = {};

        if (posthogSessionId) {
          properties.$session_id = posthogSessionId;
        }

        if (user) {
          properties.user_id = user.id;
          properties.email = user.email;
        }

        await identifyUser({
          distinctId: posthogDistinctId,
          properties,
        });
      } catch (error) {
        // Don't fail the request if PostHog identification fails
        console.error('PostHog identification failed:', error);
      }
    }
  }

  return result;
};

export default withPostHogIdentify;
