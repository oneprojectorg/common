import { createClient } from '@op/api/serverClient';
import { CommonError } from '@op/common';
import { forbidden, notFound } from 'next/navigation';
import { cache } from 'react';

/**
 * Display name for a decision's attribution ("by X"). Prefers the steward and
 * falls back to the owner — same rule as DecisionListItem (steward is
 * nullable, owner is not).
 */
export function getDecisionAttributionName(
  instance:
    | {
        steward?: { name?: string | null } | null;
        owner?: { name?: string | null } | null;
      }
    | null
    | undefined,
): string | undefined {
  return (instance?.steward ?? instance?.owner)?.name ?? undefined;
}

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
