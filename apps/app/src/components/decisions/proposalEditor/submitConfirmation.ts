import { canEditProposals, getInstanceCurrentPhase } from '@op/common/client';

type SubmitPhase = {
  phaseId: string;
  rules?: { proposals?: { submit?: boolean } };
} & Parameters<typeof canEditProposals>[0];

/**
 * Whether submitting this proposal should be confirmed first.
 *
 * True only for a draft whose current phase forbids editing after submission.
 * With editing allowed, submitting costs the author nothing they can't undo, so
 * the prompt would be noise.
 *
 * Both the missing-phase and submission-closed cases return false rather than
 * confirming: `submitProposal` rejects each of them outright, so warning about a
 * finality the server will never reach is worse than staying quiet. The
 * `!== false` matches `checkProposalsAllowed` — an unset rule still allows
 * submission.
 */
export function requiresSubmitConfirmation({
  instance,
  isDraft,
}: {
  instance: Parameters<typeof getInstanceCurrentPhase<SubmitPhase>>[0];
  isDraft: boolean;
}): boolean {
  if (!isDraft) {
    return false;
  }

  const currentPhase = getInstanceCurrentPhase(instance);

  if (!currentPhase || currentPhase.rules?.proposals?.submit === false) {
    return false;
  }

  return !canEditProposals(currentPhase);
}
