import { createSerializer, parseAsBoolean } from 'nuqs';

/**
 * First-visit flag for the proposal editor (`?new=true`).
 *
 * "Start a proposal" creates an empty draft and sends the author straight to
 * the editor, so the editor can't tell that visit apart from the author
 * reopening a draft later — both load an existing proposal. `useCreateProposal`
 * sets this flag on the destination it pushes, and the editor reads it to title
 * the page "Create proposal" rather than "Edit proposal".
 *
 * The flag is single-use: the editor snapshots it on mount and then strips it
 * from the URL, so refreshing, bookmarking or sharing that link reads as
 * editing an existing proposal, which is what it is.
 */
export const PROPOSAL_EDITOR_NEW_PARAM = 'new';

export const proposalEditorNewParser = parseAsBoolean.withDefault(false);

const serializeNewProposalParam = createSerializer({
  [PROPOSAL_EDITOR_NEW_PARAM]: proposalEditorNewParser,
});

/** Adds the first-visit flag to a freshly created draft's editor href. */
export function withNewProposalParam(href: string): string {
  return serializeNewProposalParam(href, {
    [PROPOSAL_EDITOR_NEW_PARAM]: true,
  });
}
