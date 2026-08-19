import { parseAsBoolean } from 'nuqs';

/**
 * First-visit flag for the proposal editor (`?new=true`).
 *
 * "Start a proposal" creates an empty draft and sends the author straight to
 * the editor, so the editor can't tell that visit apart from the author
 * reopening a draft later — both load an existing proposal. `useCreateProposal`
 * sets this flag on the destination it pushes, and the editor reads it to title
 * the page "Create proposal" on that first visit and "Edit proposal" whenever
 * the author comes back to the proposal.
 */
export const PROPOSAL_EDITOR_NEW_PARAM = 'new';

export const proposalEditorNewParser = parseAsBoolean.withDefault(false);

/** Adds the first-visit flag to a freshly created draft's editor href. */
export function withNewProposalParam(href: string): string {
  const separator = href.includes('?') ? '&' : '?';

  return `${href}${separator}${PROPOSAL_EDITOR_NEW_PARAM}=true`;
}
