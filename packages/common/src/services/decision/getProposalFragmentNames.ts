/**
 * Derives Y.Doc fragment names from a proposal template schema.
 *
 * Current collaboration documents store proposal content in a single `default`
 * fragment. This utility keeps the call-site contract stable while additional
 * fragments are introduced.
 */
export function getProposalFragmentNames(
  _proposalTemplate: Record<string, unknown> | null | undefined,
): string[] {
  return ['default'];
}
