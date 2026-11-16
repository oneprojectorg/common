import type { Proposal } from '@op/db/schema';

/** The `metadata.*` values blocks wrote onto a proposal copy; empty when none did. */
export function getPipelineScores(proposal: Proposal): Record<string, unknown> {
  if (!('metadata' in proposal)) {
    return {};
  }

  const { metadata } = proposal;
  const isObject =
    metadata !== null &&
    typeof metadata === 'object' &&
    !Array.isArray(metadata);

  return isObject ? { ...metadata } : {};
}
