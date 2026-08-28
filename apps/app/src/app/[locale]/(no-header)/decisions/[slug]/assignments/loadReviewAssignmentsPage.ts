import { createClient } from '@op/api/serverClient';
import { CommonError } from '@op/common';
import { forbidden, notFound } from 'next/navigation';

import { getServerFeatureFlag } from '@/lib/getServerFeatureFlag';

export interface ReviewAssignmentsPageContext {
  decisionName: string | null;
  processInstanceId: string;
  phaseId: string;
}

/**
 * The gate both screens share. Flag off is a 404, not a 403 — while it is off
 * the route does not exist for anyone.
 */
export async function loadReviewAssignmentsPage(
  slug: string,
): Promise<ReviewAssignmentsPageContext> {
  const [client, isFlagEnabled] = await Promise.all([
    createClient(),
    getServerFeatureFlag('manual_review_assignments'),
  ]);

  if (!isFlagEnabled) {
    notFound();
  }

  let decisionProfile;
  try {
    decisionProfile = await client.decision.getDecisionBySlug({ slug });
  } catch (error) {
    interruptForCommonError(error);
    throw error;
  }

  if (!decisionProfile?.processInstance) {
    notFound();
  }

  if (!decisionProfile.processInstance.access?.admin) {
    forbidden();
  }

  // A stateless instance has no phase to assign in.
  const phaseId = decisionProfile.processInstance.currentStateId;
  if (!phaseId) {
    forbidden();
  }

  return {
    decisionName: decisionProfile.name ?? null,
    processInstanceId: decisionProfile.processInstance.id,
    phaseId,
  };
}

// 401 joins 403 so an anonymous SSR pass renders the forbidden screen, not a 500.
function interruptForCommonError(error: unknown): void {
  const cause = error instanceof Error ? error.cause : null;
  if (!(cause instanceof CommonError)) {
    return;
  }
  if (cause.statusCode === 401 || cause.statusCode === 403) {
    forbidden();
  }
  if (cause.statusCode === 404 || cause.statusCode === 400) {
    notFound();
  }
}
