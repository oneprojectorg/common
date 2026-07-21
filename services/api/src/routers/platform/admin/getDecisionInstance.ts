import { NotFoundError } from '@op/common';
import { adminDecisionInstanceDetailSchema } from '@op/common/client';
import { db } from '@op/db/client';
import { z } from 'zod';

import { withAuthenticatedPlatformAdmin } from '../../../middlewares/withAuthenticatedPlatformAdmin';
import withRateLimited from '../../../middlewares/withRateLimited';
import { commonProcedure, router } from '../../../trpcFactory';

const phaseRulesSchema = z
  .object({
    proposals: z
      .object({
        submit: z.boolean().optional(),
        edit: z.boolean().optional(),
        review: z.boolean().optional(),
        defaults: z.object({ hidden: z.boolean().optional() }).optional(),
      })
      .partial()
      .optional(),
    voting: z
      .object({
        submit: z.boolean().optional(),
        edit: z.boolean().optional(),
        maxVotesPerMember: z.number().optional(),
      })
      .partial()
      .optional(),
    advancement: z
      .object({ method: z.string().optional() })
      .partial()
      .optional(),
  })
  .partial();

const detailInstanceData = z
  .object({
    config: z
      .object({
        reviewsPolicy: z.string().optional(),
        reviewsAllowRevisions: z.boolean().optional(),
        reviewsAnonymousFeedback: z.boolean().optional(),
        isPrivate: z.boolean().optional(),
        hideBudget: z.boolean().optional(),
        requireCategorySelection: z.boolean().optional(),
        allowMultipleCategories: z.boolean().optional(),
        organizeByCategories: z.boolean().optional(),
        requireCollaborativeProposals: z.boolean().optional(),
        categories: z.array(z.unknown()).optional(),
      })
      .partial()
      .optional(),
    templateName: z.string().optional(),
    templateVersion: z.string().optional(),
    proposalTemplate: z.unknown().optional(),
    rubricTemplate: z.unknown().optional(),
    phases: z
      .array(
        z.object({
          phaseId: z.string(),
          name: z.string().optional(),
          startDate: z.string().optional(),
          endDate: z.string().optional(),
          rules: phaseRulesSchema.optional(),
        }),
      )
      .optional(),
  })
  .partial();

/** Phase rules can also live on the process schema's phase definitions. */
const detailProcessSchema = z
  .object({
    phases: z
      .array(
        z.object({
          id: z.string(),
          rules: phaseRulesSchema.optional(),
        }),
      )
      .optional(),
  })
  .partial();

export const getDecisionInstanceRouter = router({
  getDecisionInstance: commonProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 30 }))
    .use(withAuthenticatedPlatformAdmin)
    .input(z.object({ instanceId: z.uuid() }))
    .output(adminDecisionInstanceDetailSchema)
    .query(async ({ input }) => {
      const instance = await db.query.processInstances.findFirst({
        where: { id: input.instanceId },
        with: {
          owner: { columns: { id: true, name: true, slug: true } },
          steward: { columns: { id: true, name: true, slug: true } },
          profile: { columns: { slug: true } },
          process: { columns: { name: true, processSchema: true } },
        },
      });

      if (!instance) {
        throw new NotFoundError('Decision instance not found');
      }

      const parsed = detailInstanceData.safeParse(instance.instanceData);
      const instanceData = parsed.success ? parsed.data : {};

      const schemaParsed = detailProcessSchema.safeParse(
        instance.process?.processSchema,
      );
      const schemaRulesByPhaseId = new Map(
        (schemaParsed.success ? (schemaParsed.data.phases ?? []) : []).map(
          (phase) => [phase.id, phase.rules],
        ),
      );

      return adminDecisionInstanceDetailSchema.parse({
        id: instance.id,
        name: instance.name,
        slug: instance.profile?.slug ?? null,
        status: instance.status,
        createdAt: instance.createdAt,
        owner: instance.owner ?? null,
        steward: instance.steward ?? null,
        reviewsPolicy: instanceData.config?.reviewsPolicy ?? null,
        processType:
          instanceData.templateName ?? instance.process?.name ?? null,
        templateVersion: instanceData.templateVersion ?? null,
        config: {
          isPrivate: instanceData.config?.isPrivate ?? false,
          hideBudget: instanceData.config?.hideBudget ?? false,
          hasProposalTemplate: instanceData.proposalTemplate != null,
          hasRubric: instanceData.rubricTemplate != null,
          reviewsAllowRevisions:
            instanceData.config?.reviewsAllowRevisions ?? false,
          reviewsAnonymousFeedback:
            instanceData.config?.reviewsAnonymousFeedback ?? false,
          requireCategorySelection:
            instanceData.config?.requireCategorySelection ?? false,
          allowMultipleCategories:
            instanceData.config?.allowMultipleCategories ?? false,
          organizeByCategories:
            instanceData.config?.organizeByCategories ?? false,
          requireCollaborativeProposals:
            instanceData.config?.requireCollaborativeProposals ?? false,
          categoriesCount: instanceData.config?.categories?.length ?? 0,
        },
        phases: (instanceData.phases ?? []).map((phase) => {
          // Instance rules win; fall back to the process schema definition
          // (older instances don't copy every rule into instanceData).
          const rules = phase.rules ?? schemaRulesByPhaseId.get(phase.phaseId);
          return {
            phaseId: phase.phaseId,
            name: phase.name ?? null,
            startDate: phase.startDate ?? null,
            endDate: phase.endDate ?? null,
            isCurrent: phase.phaseId === instance.currentStateId,
            hasProposals: rules?.proposals?.submit ?? false,
            hasReviews: rules?.proposals?.review ?? false,
            hasVoting: rules?.voting?.submit ?? false,
            canEditProposals: rules?.proposals?.edit ?? false,
            canEditVotes: rules?.voting?.edit ?? false,
            maxVotesPerMember: rules?.voting?.maxVotesPerMember ?? null,
            proposalsHiddenByDefault:
              rules?.proposals?.defaults?.hidden ?? false,
            advancementMethod: rules?.advancement?.method ?? null,
          };
        }),
      });
    }),
});
