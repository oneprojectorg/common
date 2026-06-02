import 'server-only';

import { createServerUtils } from '@op/api/server';
import { cache } from 'react';

/**
 * Per-request memoized reads for server rendering.
 *
 * Wrapping each fetch in React `cache()` dedupes it across `generateMetadata`
 * and the page render — Next runs both in the same request — so the underlying
 * tRPC resolver (and its "viewed" analytics side effect) executes exactly once
 * per page view. The fetch also populates the shared `createServerUtils`
 * queryClient, which the page dehydrates so the client hydrates without
 * re-fetching. This is the React-cache dedup the Next metadata docs recommend.
 */
export const renderProposal = cache(async (profileId: string) => {
  const { utils } = await createServerUtils();
  return utils.decision.getProposal.fetch({ profileId });
});

export const renderDecisionBySlug = cache(async (slug: string) => {
  const { utils } = await createServerUtils();
  return utils.decision.getDecisionBySlug.fetch({ slug });
});

export const renderInstance = cache(async (instanceId: string) => {
  const { utils } = await createServerUtils();
  return utils.decision.getInstance.fetch({ instanceId });
});

export const renderLegacyInstance = cache(async (instanceId: string) => {
  const { utils } = await createServerUtils();
  return utils.decision.getLegacyInstance.fetch({ instanceId });
});
