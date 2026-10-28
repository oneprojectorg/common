import type { ProposalTemplateSchema } from './types';

/**
 * A template field's display name for messages. Fields are keyed by a
 * generated ID, so fall back to the key only when the field has no title or
 * no longer exists.
 */
export function getTemplateFieldName({
  proposalTemplate,
  fieldKey,
}: {
  proposalTemplate: ProposalTemplateSchema | null;
  fieldKey: string;
}): string {
  return proposalTemplate?.properties?.[fieldKey]?.title?.trim() || fieldKey;
}
