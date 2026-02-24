import {
  SYSTEM_FIELD_KEYS,
  getProposalTemplateFieldOrder,
} from './getProposalTemplateFieldOrder';
import type { ProposalTemplateSchema } from './types';

/**
 * Derives the TipTap Cloud fragment names to fetch server-side from a proposal template schema.
 *
 * System fields (title, budget, category) are excluded because they are
 * handled through separate code paths (e.g. proposalData, translation)
 * and including them would cause key collisions.
 *
 * When no template is provided, falls back to `['default']` for backward
 * compatibility with legacy single-fragment documents.
 */
export function getProposalFragmentNames(
  proposalTemplate: ProposalTemplateSchema,
): string[] {
  const properties = proposalTemplate.properties;

  if (!properties || Object.keys(properties).length === 0) {
    return ['default'];
  }

  const { all } = getProposalTemplateFieldOrder(proposalTemplate);
  const fragments: string[] = [];

  for (const key of all) {
    if (properties[key] && !SYSTEM_FIELD_KEYS.has(key)) {
      fragments.push(key);
    }
  }

  return fragments.length > 0 ? fragments : ['default'];
}
