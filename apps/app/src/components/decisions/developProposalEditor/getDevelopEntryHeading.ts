import type { ProposalTemplateSchema } from '@op/common/client';

/** The develop heading and page title: the form's title, else `fallback`. */
export function getDevelopEntryHeading({
  template,
  fallback,
}: {
  template: ProposalTemplateSchema | null;
  fallback: string;
}): string {
  return template?.title || fallback;
}
