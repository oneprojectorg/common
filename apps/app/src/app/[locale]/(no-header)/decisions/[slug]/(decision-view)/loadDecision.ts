import { createClient } from '@op/api/serverClient';
import { CommonError } from '@op/common';
import { forbidden, notFound } from 'next/navigation';
import { cache } from 'react';

/**
 * Resolve a decision profile by slug for the (decision-view) route group.
 *
 * Wrapped in React `cache` so the layout and the active page (overview or
 * current) share a single fetch within one request instead of each hitting
 * the API. Throws the framework's `forbidden()` / `notFound()` so the nearest
 * boundary renders the right error UI.
 */
export const loadDecision = cache(async (slug: string) => {
  const client = await createClient();

  let decisionProfile;
  try {
    decisionProfile = await client.decision.getDecisionBySlug({ slug });
  } catch (error) {
    const cause = error instanceof Error ? error.cause : null;
    if (cause instanceof CommonError && cause.statusCode === 403) {
      forbidden();
    }
    if (cause instanceof CommonError && cause.statusCode === 404) {
      notFound();
    }
    throw error;
  }

  if (!decisionProfile || !decisionProfile.processInstance) {
    notFound();
  }

  const instanceId = decisionProfile.processInstance.id;
  const ownerSlug = decisionProfile.processInstance.owner?.slug;

  if (!ownerSlug) {
    notFound();
  }

  return { decisionProfile, instanceId, ownerSlug };
});
