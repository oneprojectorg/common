import { getUser } from '@/utils/getUser';
import { requireRealAccount } from '@/utils/walledGarden';
import { createClient } from '@op/api/serverClient';
import { CommonError } from '@op/common';
import { forbidden, notFound } from 'next/navigation';
import { cache } from 'react';

export const loadDecision = cache(async (slug: string) => {
  const client = await createClient();

  let decisionProfile;
  try {
    decisionProfile = await client.decision.getDecisionBySlug({ slug });
  } catch (error) {
    const cause = error instanceof Error ? error.cause : null;
    if (cause instanceof CommonError && cause.statusCode === 403) {
      // The 403 conflates "missing" and "no access" (an existence-leak guard),
      // so all we know is that this viewer can't read it — leaving the viewer
      // to decide the response. Signing in can still let a signed-out or
      // anonymous visitor in, so send them to login with a way back; a refused
      // real account gains nothing there and falls through to the no-access
      // screen, which offers any pending invite for this decision.
      await requireRealAccount(await getUser());
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
