import { createClient } from '@op/api/serverClient';
import { CommonError } from '@op/common';
import { forbidden, notFound } from 'next/navigation';

export interface ReviewAssignmentsPageContext {
  processInstanceId: string;
  phaseId: string;
}

/** The admin gate both screens share. */
export async function loadReviewAssignmentsPage(
  slug: string,
): Promise<ReviewAssignmentsPageContext> {
  const client = await createClient();

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
