import { handleServerError } from '@/utils/handleServerError';
import { createServerUtils } from '@op/api/server';
import { cache } from 'react';

/**
 * Fetch the proposal and its decision on the server, resolving an expected
 * rejection into the matching navigation interrupt (403 → forbidden(),
 * 404 → notFound()).
 *
 * Both proposal routes render client trees whose suspense queries re-run
 * during SSR, and a rejection there arrives as an unhandled rejection rather
 * than an error React can hand to a boundary — so `ResourceErrorBoundary`
 * never sees it and Next fails the whole render instead of showing the
 * scoped page. Resolving here, the same way `loadDecision` does for
 * /decisions/[slug], settles access before the client tree mounts and warms
 * the dehydrated cache the client reads from.
 *
 * `cache()` dedupes the read across generateMetadata and the page render.
 */
export const loadProposal = cache(
  async ({ slug, profileId }: { slug: string; profileId: string }) => {
    const { utils } = await createServerUtils();

    try {
      const [proposal, decisionProfile] = await Promise.all([
        utils.decision.getProposal.fetch({ profileId }),
        utils.decision.getDecisionBySlug.fetch({ slug }),
      ]);

      return { proposal, decisionProfile };
    } catch (error) {
      handleServerError(error);
    }
  },
);
