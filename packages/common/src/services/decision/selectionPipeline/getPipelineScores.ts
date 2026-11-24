import type { Proposal } from '@op/db/schema';

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
