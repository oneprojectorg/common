import { cachePerRequest } from '@op/api/cachePerRequest';
import { createClient } from '@op/api/serverClient';
import { CommonError } from '@op/common';
import '@tanstack/react-start/server-only';
import { forbidden, notFound } from '@/lib/navigation';

/**
 * The decision behind `/decisions/$slug` and its tabs, fetched once per
 * request however many loaders (and the OG card) ask.
 */
export const loadDecision = cachePerRequest(async (slug: string) => {
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
