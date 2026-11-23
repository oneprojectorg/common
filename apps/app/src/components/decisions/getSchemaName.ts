import type { ProposalTemplateSchema } from '@op/common/client';

/** The form schema's title, else `fallback`. */
export function getSchemaName({
  template,
  fallback,
}: {
  template: ProposalTemplateSchema | null;
  fallback: string;
}): string {
  return template?.title || fallback;
}
