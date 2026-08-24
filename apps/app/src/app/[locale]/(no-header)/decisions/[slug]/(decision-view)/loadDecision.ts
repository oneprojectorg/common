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
      // getDecisionBySlug refuses "missing" and "no access" identically (a
      // deliberate existence-leak guard), so all we know here is that this
      // viewer can't read it. A signed-out or anonymous visitor — most of this
      // route's refusals, since decision links travel by email — can still get
      // in by signing in, so send them to login with a way back rather than to
      // a dead-end screen. A real account that was refused gains nothing by
      // re-authenticating: it falls through to the invite-aware no-access page.
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
