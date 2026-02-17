import { anthropic } from '@ai-sdk/anthropic';
import { assertUserByAuthId, createInstanceFromTemplateCore } from '@op/common';
import { CommonError, UnauthorizedError } from '@op/common';
import { db } from '@op/db/client';
import { decisionProcesses } from '@op/db/schema';
import { TRPCError } from '@trpc/server';
import { generateObject } from 'ai';
import { z } from 'zod';

import { decisionProfileWithSchemaEncoder } from '../../../encoders/decision';
import { commonAuthedProcedure, router } from '../../../trpcFactory';

/**
 * Zod schema matching DecisionSchemaDefinition for AI structured output.
 */
const phaseRulesSchema = z.object({
  proposals: z
    .object({
      submit: z.boolean().optional(),
      edit: z.boolean().optional(),
      review: z.boolean().optional(),
    })
    .optional(),
  voting: z
    .object({
      submit: z.boolean().optional(),
      edit: z.boolean().optional(),
    })
    .optional(),
  advancement: z
    .object({
      method: z.enum(['date', 'manual']),
    })
    .optional(),
});

const selectionPipelineBlockSchema = z.object({
  id: z.string(),
  type: z.enum(['sort', 'limit', 'filter']),
  name: z.string().optional(),
  sortBy: z
    .array(
      z.object({
        field: z.string(),
        order: z.enum(['asc', 'desc']),
      }),
    )
    .optional(),
  count: z.union([z.number(), z.object({ variable: z.string() })]).optional(),
});

const selectionPipelineSchema = z.object({
  version: z.string(),
  blocks: z.array(selectionPipelineBlockSchema),
});

const settingsSchema = z.object({
  type: z.literal('object'),
  required: z.array(z.string()).optional(),
  properties: z.record(
    z.string(),
    z.object({
      type: z.enum(['number', 'string', 'boolean']),
      title: z.string(),
      description: z.string().optional(),
      minimum: z.number().optional(),
      maximum: z.number().optional(),
      default: z.union([z.number(), z.string(), z.boolean()]).optional(),
    }),
  ),
  ui: z
    .record(
      z.string(),
      z.object({
        'ui:widget': z.string().optional(),
        'ui:placeholder': z.string().optional(),
      }),
    )
    .optional(),
});

const phaseDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  rules: phaseRulesSchema,
  selectionPipeline: selectionPipelineSchema.optional(),
  settings: settingsSchema.optional(),
});

const processConfigSchema = z.object({
  hideBudget: z.boolean().optional(),
  categories: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        description: z.string(),
      }),
    )
    .optional(),
  requireCategorySelection: z.boolean().optional(),
  allowMultipleCategories: z.boolean().optional(),
});

const decisionSchemaDefinitionSchema = z.object({
  id: z.string(),
  version: z.string(),
  name: z.string(),
  description: z.string().optional(),
  config: processConfigSchema.optional(),
  phases: z.array(phaseDefinitionSchema).min(1),
});

const SYSTEM_PROMPT = `You are a decision process designer. Given a description of a decision-making process, generate a DecisionSchemaDefinition that models it.

A DecisionSchemaDefinition defines the phases of a structured decision process. Each phase has:
- id: a kebab-case identifier
- name: human-readable name
- description: what happens in this phase
- rules: controls what actions are allowed (proposals.submit, voting.submit, etc.) and how the phase advances (date or manual)
- selectionPipeline (optional): how proposals are filtered/sorted when advancing to the next phase
- settings (optional): configurable settings for the phase as JSON Schema

Key design principles:
1. Phases should flow logically (e.g., submission -> review -> voting -> results)
2. Only the submission phase should allow proposal submissions (proposals.submit: true)
3. Only the voting phase should allow vote submissions (voting.submit: true)
4. Use manual advancement by default (method: 'manual')
5. The id should be a unique kebab-case string
6. Always include a final "results" phase where everything is locked down
7. Keep settings simple and relevant to each phase
8. The top-level id should be a kebab-case identifier for the whole process
9. version should be "1.0.0"

Here is an example of a Simple Voting process for reference:

{
  "id": "simple",
  "version": "1.0.0",
  "name": "Simple Voting",
  "description": "Basic approval voting where members vote for multiple proposals.",
  "phases": [
    {
      "id": "submission",
      "name": "Proposal Submission",
      "description": "Members submit proposals for consideration.",
      "rules": {
        "proposals": { "submit": true },
        "voting": { "submit": false },
        "advancement": { "method": "manual" }
      },
      "settings": {
        "type": "object",
        "properties": {
          "maxProposalsPerMember": {
            "type": "number",
            "title": "Maximum Proposals Per Member",
            "description": "How many proposals can each member submit?",
            "minimum": 1,
            "default": 3
          }
        }
      }
    },
    {
      "id": "review",
      "name": "Review & Shortlist",
      "description": "Reviewers evaluate and shortlist proposals.",
      "rules": {
        "proposals": { "submit": false },
        "voting": { "submit": false },
        "advancement": { "method": "manual" }
      }
    },
    {
      "id": "voting",
      "name": "Voting",
      "description": "Members vote on shortlisted proposals.",
      "rules": {
        "proposals": { "submit": false },
        "voting": { "submit": true },
        "advancement": { "method": "manual" }
      },
      "settings": {
        "type": "object",
        "required": ["maxVotesPerMember"],
        "properties": {
          "maxVotesPerMember": {
            "type": "number",
            "title": "Maximum Votes Per Member",
            "description": "How many proposals can each member vote for?",
            "minimum": 1,
            "default": 3
          }
        }
      },
      "selectionPipeline": {
        "version": "1.0.0",
        "blocks": [
          {
            "id": "sort-by-likes",
            "type": "sort",
            "name": "Sort by likes count",
            "sortBy": [{ "field": "voteData.likesCount", "order": "desc" }]
          },
          {
            "id": "limit-by-votes",
            "type": "limit",
            "name": "Take top N",
            "count": { "variable": "maxVotesPerMember" }
          }
        ]
      }
    },
    {
      "id": "results",
      "name": "Results",
      "description": "View final results and winning proposals.",
      "rules": {
        "proposals": { "submit": false },
        "voting": { "submit": false },
        "advancement": { "method": "manual" }
      }
    }
  ]
}

Generate a process definition appropriate for the user's description. Be creative but practical.`;

export const generateProcessRouter = router({
  generateProcessFromDescription: commonAuthedProcedure({
    rateLimit: { windowSize: 60, maxRequests: 5 },
  })
    .input(
      z.object({
        description: z.string().min(10).max(2000),
      }),
    )
    .output(decisionProfileWithSchemaEncoder)
    .mutation(async ({ ctx, input }) => {
      const { user, logger } = ctx;

      try {
        // Resolve user info
        const dbUser = await assertUserByAuthId(user.id);
        const ownerProfileId = dbUser.currentProfileId ?? dbUser.profileId;
        if (!ownerProfileId) {
          throw new UnauthorizedError('User must have an active profile');
        }
        if (!user.email) {
          throw new CommonError('User must have an email address');
        }

        // Generate the decision schema from the description
        const result = await generateObject({
          model: anthropic('claude-sonnet-4-5-20250929'),
          system: SYSTEM_PROMPT,
          prompt: input.description,
          schema: decisionSchemaDefinitionSchema,
        });
        const schema = result.object as z.infer<
          typeof decisionSchemaDefinitionSchema
        >;

        // Save the generated schema as a new decision process template
        const [template] = await db
          .insert(decisionProcesses)
          .values({
            name: schema.name,
            description: schema.description,
            processSchema: schema,
            createdByProfileId: ownerProfileId,
          })
          .returning();

        if (!template) {
          throw new CommonError('Failed to create decision process template');
        }

        // Create an instance from the new template
        const profile = await createInstanceFromTemplateCore({
          templateId: template.id,
          name: schema.name,
          description: schema.description,
          ownerProfileId,
          creatorAuthUserId: user.id,
          creatorEmail: user.email,
        });

        logger.info('AI-generated decision process created', {
          userId: user.id,
          processName: schema.name,
          templateId: template.id,
        });

        return decisionProfileWithSchemaEncoder.parse(profile);
      } catch (error: unknown) {
        logger.error('Failed to generate decision process', {
          userId: user.id,
          error,
        });

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          message: 'Failed to generate decision process',
          code: 'INTERNAL_SERVER_ERROR',
        });
      }
    }),
});
