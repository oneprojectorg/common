import { loadDecision } from '@/server/decisions/loadDecision';
import { loadReviewAssignmentsPage } from '@/server/decisions/reviewAssignments';
import {
  loadProposalReviews,
  loadReviewLayout,
} from '@/server/decisions/reviews';
import { serializeDehydratedState } from '@op/api/dehydratedState';
import { ProcessStatus } from '@op/api/encoders';
import { createServerUtils, dehydrate } from '@op/api/server';
import { createClient } from '@op/api/serverClient';
import { logger } from '@op/logging';
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

import {
  serializeDecisionEditor,
  serializeDecisionView,
} from '@/lib/decisionView';
import { forbidden, notFound } from '@/lib/navigation';

import type { ProcessBuilderInstanceData } from '@/components/decisions/ProcessBuilder/stores/useProcessBuilderStore';

const slugSchema = z.object({ slug: z.string() });

/**
 * The decision behind the overview and current-phase tabs: the single slug
 * fetch, which the router enriches with `access` + encoded `instanceData`.
 */
export const getDecisionView = createServerFn({ method: 'GET' })
  .validator(slugSchema)
  .handler(async ({ data }) =>
    serializeDecisionView(await loadDecision(data.slug)),
  );

/**
 * Seeds the getInstance cache the current-phase content (DecisionStateRouter)
 * hydrates from — the overview is single-fetch, so /current seeds its own.
 * Best effort: on failure the client refetches under its own boundary.
 */
export const prefetchCurrentPhase = createServerFn({ method: 'GET' })
  .validator(z.object({ instanceId: z.string() }))
  .handler(async ({ data }) => {
    const { utils, queryClient } = await createServerUtils();
    try {
      await utils.decision.getInstance.fetch({ instanceId: data.instanceId });
    } catch (error) {
      logger.warn('Failed to seed current-phase instance', {
        instanceId: data.instanceId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return serializeDehydratedState(dehydrate(queryClient));
  });

/** The process builder's server seed — admin only. */
export const getDecisionEditor = createServerFn({ method: 'GET' })
  .validator(slugSchema)
  .handler(async ({ data }) => {
    const client = await createClient();

    // Get the decision profile to find the instance ID
    const decisionProfile = await client.decision.getDecisionBySlug({
      slug: data.slug,
    });

    if (!decisionProfile?.processInstance) {
      notFound();
    }

    if (!decisionProfile.processInstance.access?.admin) {
      forbidden();
    }

    const { processInstance } = decisionProfile;
    const instanceData =
      processInstance.instanceData as ProcessBuilderInstanceData;

    // Seed the store with server data so validation works immediately.
    const serverData: ProcessBuilderInstanceData = {
      name: decisionProfile.name ?? undefined,
      description: processInstance.description ?? undefined,
      stewardProfileId: processInstance.steward?.id,
      phases: instanceData.phases,
      proposalTemplate: instanceData.proposalTemplate,
      rubricTemplate: instanceData.rubricTemplate,
      config: instanceData.config,
    };

    return serializeDecisionEditor({
      decisionProfileId: decisionProfile.id,
      decisionName: decisionProfile.name,
      instanceId: processInstance.id,
      isDraft: processInstance.status === ProcessStatus.DRAFT,
      serverData,
    });
  });

/** The reviewers table — admin only. */
export const prefetchReviewAssignments = createServerFn({ method: 'GET' })
  .validator(slugSchema)
  .handler(async ({ data }) => {
    const { processInstanceId, phaseId } = await loadReviewAssignmentsPage(
      data.slug,
    );

    // Best effort: on failure the client refetches under its own boundary.
    const { utils, queryClient } = await createServerUtils();
    try {
      await utils.decision.listPhaseReviewerSummaries.fetchInfinite({
        processInstanceId,
        phaseId,
      });
    } catch (error) {
      logger.warn('Failed to preload phase review assignments', {
        processInstanceId,
        phaseId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return {
      processInstanceId,
      phaseId,
      dehydratedState: serializeDehydratedState(dehydrate(queryClient)),
    };
  });

/** One reviewer's assignments — admin only. */
export const prefetchReviewerAssignments = createServerFn({ method: 'GET' })
  .validator(z.object({ slug: z.string(), profileId: z.string() }))
  .handler(async ({ data }) => {
    const { processInstanceId, phaseId, access } =
      await loadReviewAssignmentsPage(data.slug);

    // The SSR render has no browser client, so the suspending input needs a seed.
    const { utils, queryClient } = await createServerUtils();
    const preloaded = await utils.decision.listReviewerAssignments
      .fetchInfinite({
        processInstanceId,
        phaseId,
        reviewerProfileId: data.profileId,
      })
      .catch((error: unknown) => {
        logger.warn('Failed to preload reviewer assignments', {
          processInstanceId,
          phaseId,
          reviewerProfileId: data.profileId,
          error,
        });

        return null;
      });

    if (preloaded && !preloaded.pages[0]?.reviewer) {
      notFound();
    }

    return {
      processInstanceId,
      phaseId,
      access,
      dehydratedState: serializeDehydratedState(dehydrate(queryClient)),
    };
  });

/**
 * Warms the proposal view. The reads run once here, so the resolver and its
 * "viewed" event fire once and the data hydrates. Failures are swallowed: this
 * only warms the cache — the client suspense query refetches and its error
 * boundary owns errors, so a failed warmup must not crash the route.
 */
export const prefetchProposalView = createServerFn({ method: 'GET' })
  .validator(z.object({ slug: z.string(), profileId: z.string() }))
  .handler(async ({ data }) => {
    const { utils, queryClient } = await createServerUtils();
    const titles = await Promise.all([
      utils.decision.getProposal.fetch({ profileId: data.profileId }),
      utils.decision.getDecisionBySlug.fetch({ slug: data.slug }),
    ])
      .then(([proposal, decisionProfile]) => ({
        proposalName: proposal.profile?.name ?? null,
        decisionName: decisionProfile?.name ?? null,
      }))
      .catch(() => null);

    return {
      dehydratedState: serializeDehydratedState(dehydrate(queryClient)),
      titles,
    };
  });

/** The reviewer's split-pane review screen. */
export const getReviewView = createServerFn({ method: 'GET' })
  .validator(z.object({ slug: z.string(), assignmentId: z.string() }))
  .handler(({ data }) =>
    loadReviewLayout({
      decisionSlug: data.slug,
      assignmentId: data.assignmentId,
    }),
  );

/** The proposal-keyed reviews URL: admin summary or the reviewer's screen. */
export const getProposalReviewsView = createServerFn({ method: 'GET' })
  .validator(z.object({ slug: z.string(), profileId: z.string() }))
  .handler(({ data }) =>
    loadProposalReviews({
      decisionSlug: data.slug,
      proposalProfileId: data.profileId,
    }),
  );
