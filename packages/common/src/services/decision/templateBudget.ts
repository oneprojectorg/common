import type { ProposalTemplateSchema } from './types';

/**
 * Whether a proposal template collects a budget — i.e. has a `budget` key in
 * its `properties`. The process builder deletes the key entirely when the
 * budget toggle is switched off, so presence is the source of truth.
 */
export function templateCollectsBudget(
  template: ProposalTemplateSchema | null | undefined,
): boolean {
  return Boolean(template?.properties && 'budget' in template.properties);
}
