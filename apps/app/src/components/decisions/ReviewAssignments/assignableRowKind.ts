import type { AssignableProposal } from '@op/common/client';

/** How a proposal row behaves for this reviewer. */
export type RowKind = 'own' | 'locked' | 'assigned' | 'free';

// An existing assignment outranks "own proposal" — a stray self-assignment
// must stay visible and, while pending, removable.
export function rowKindOf(proposal: AssignableProposal): RowKind {
  if (proposal.assignment) {
    return proposal.assignment.status === 'pending' ? 'assigned' : 'locked';
  }
  return proposal.isOwn ? 'own' : 'free';
}
