import type { ProposalTemplateSchema } from './types';

/**
 * Whether a proposal template collects a location — i.e. has a field with the
 * `location` x-format. When true, a proposal's location is mandatory and must
 * fall inside a boundary to be submitted (see `submitProposal`).
 */
export function templateCollectsLocation(
  template: ProposalTemplateSchema | null | undefined,
): boolean {
  if (!template?.properties) {
    return false;
  }

  return Object.values(template.properties).some(
    (schema) => schema['x-format'] === 'location',
  );
}
