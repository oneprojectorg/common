import type { ProposalTemplateSchema } from '@op/common/client';

/**
 * The heading of the develop editor, which the page title repeats: the entry
 * form's own title, else `fallback`. The fixed fallback word stands in until
 * the entry form PR gives the phase's entry form its own name.
 */
export function getDevelopEntryHeading({
  template,
  fallback,
}: {
  template: ProposalTemplateSchema | null;
  fallback: string;
}): string {
  return template?.title || fallback;
}
