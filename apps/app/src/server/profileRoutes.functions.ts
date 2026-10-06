import { handleServerError } from '@/utils/handleServerError';
import { serializeDehydratedState } from '@op/api/dehydratedState';
import { createServerUtils, dehydrate } from '@op/api/server';
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

/**
 * Warms the legacy decision view: the read runs once here, so its resolver and
 * "viewed" event fire once, and the result hydrates the client's suspense
 * query. Failures are swallowed — the client query refetches and its error
 * boundary owns errors, so a failed warmup must not crash the route.
 */
export const prefetchLegacyDecision = createServerFn({ method: 'GET' })
  .validator(z.object({ instanceId: z.string() }))
  .handler(async ({ data }) => {
    const { utils, queryClient } = await createServerUtils();
    const instance = await utils.decision.getLegacyInstance
      .fetch({ instanceId: data.instanceId })
      .then((result) => ({ name: result?.name ?? null }))
      .catch(() => null);

    return {
      dehydratedState: serializeDehydratedState(dehydrate(queryClient)),
      instance,
    };
  });

/** Warms a legacy proposal page; failures are left to the client boundary. */
export const prefetchLegacyProposal = createServerFn({ method: 'GET' })
  .validator(z.object({ profileId: z.string() }))
  .handler(async ({ data }) => {
    const { utils, queryClient } = await createServerUtils();
    const proposal = await utils.decision.getProposal
      .fetch({ profileId: data.profileId })
      .then((result) => ({ name: result.profile?.name ?? null }))
      .catch(() => null);

    return {
      dehydratedState: serializeDehydratedState(dehydrate(queryClient)),
      proposal,
    };
  });

/** Warms the legacy proposal editor; failures are left to the client boundary. */
export const prefetchLegacyProposalEdit = createServerFn({ method: 'GET' })
  .validator(z.object({ profileId: z.string(), instanceId: z.string() }))
  .handler(async ({ data }) => {
    const { utils, queryClient } = await createServerUtils();
    const titles = await Promise.all([
      utils.decision.getProposal.fetch({ profileId: data.profileId }),
      utils.decision.getInstance.fetch({ instanceId: data.instanceId }),
    ])
      .then(([proposal, instance]) => ({
        proposalName: proposal.profile?.name ?? null,
        instanceName: instance?.name ?? null,
      }))
      .catch(() => null);

    return {
      dehydratedState: serializeDehydratedState(dehydrate(queryClient)),
      titles,
    };
  });

/**
 * Loads a post and its organization. A missing post or org throws
 * NotFoundError; it becomes a 404 rather than bubbling up as a 500.
 */
export const prefetchPost = createServerFn({ method: 'GET' })
  .validator(z.object({ postId: z.string(), slug: z.string() }))
  .handler(async ({ data }) => {
    const { utils, queryClient } = await createServerUtils();

    try {
      const [post, organization] = await Promise.all([
        utils.posts.getPost.fetch({
          postId: data.postId,
          includeChildren: false,
        }),
        utils.organization.getBySlug.fetch({ slug: data.slug }),
      ]);

      return {
        dehydratedState: serializeDehydratedState(dehydrate(queryClient)),
        hasPost: Boolean(post),
        orgName: organization?.profile?.name ?? null,
      };
    } catch (error) {
      handleServerError(error);
    }
  });
