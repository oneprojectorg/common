import { getProposalTemplateFieldOrder } from './getProposalTemplateFieldOrder';

/**
 * Derives the TipTap Cloud fragment names to fetch server-side from a proposal template schema.
 *
 * When no template is provided, falls back to `['default']` for backward
 * compatibility with legacy single-fragment documents.
 */
export function getProposalFragmentNames(
  proposalTemplate: Record<string, unknown>,
): string[] {
  const properties = proposalTemplate.properties as
    | Record<string, Record<string, unknown>>
    | undefined;

  if (!properties || Object.keys(properties).length === 0) {
    return ['default'];
  }

  const { all } = getProposalTemplateFieldOrder(proposalTemplate);
  const fragments: string[] = [];

  for (const key of all) {
    if (properties[key]) {
      fragments.push(key);
    }
  }

  return fragments.length > 0 ? fragments : ['default'];
}
