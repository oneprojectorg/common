import { db } from '@op/db/client';
import { ProposalReviewState, ProposalStatus } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';
import { z } from 'zod';

import {
  type MappingInput,
  type MappingResult,
  type SchemaMapping,
  type SchemaRef,
  mapToSchema,
  schemaMappingSchema,
} from '../../schemaMapping';
import { CommonError, NotFoundError, ValidationError } from '../../utils';
import { assertProfileAccess } from '../assert';
import { getInstance } from './getInstance';
import { getProposalDocumentsContent } from './getProposalDocumentsContent';
import { decisionPermission } from './permissions';
import { parseProposalData } from './proposalDataSchema';
import { resolveDocumentFieldValues } from './proposalListPreview';
import { resolveProposalTemplatesByFormSchemaId } from './resolveProposalTemplate';
import type { DecisionInstanceData } from './schemas/instanceData';
import { assertInstancePhase } from './utils/instance';
import {
  getPhaseProposalTemplate,
  getPhaseRubricTemplate,
} from './utils/phaseTemplates';

export type DevelopPrefillInput = {
  type: 'proposal' | 'review';
  phaseId: string;
  id: string;
};

const developPrefillRequestSchema = z.object({
  inputs: z
    .array(
      z.strictObject({
        type: z.enum(['proposal', 'review']),
        phaseId: z.string().min(1),
        id: z.uuid(),
      }),
    )
    .min(1),
  target: z.strictObject({
    type: z.literal('proposal'),
    phaseId: z.string().min(1),
  }),
  mappings: z.array(schemaMappingSchema),
});

/**
 * Builds the starting data of a developed proposal: maps the given proposals
 * and their reviews into the target phase's proposal form with `mappings`.
 * A target field whose inputs give different values stays empty.
 */
export const getDevelopPrefill = async ({
  instanceId,
  inputs,
  target,
  mappings,
  user,
}: {
  instanceId: string;
  inputs: DevelopPrefillInput[];
  target: { type: 'proposal'; phaseId: string };
  mappings: SchemaMapping[];
  user: User;
}): Promise<MappingResult> => {
  const request = developPrefillRequestSchema.safeParse({
    inputs,
    target,
    mappings,
  });
  if (!request.success) {
    throw toValidationError(request.error);
  }

  const instance = await getInstance({ instanceId, user });
  if (!instance.profileId) {
    throw new CommonError(
      'Decision instance does not have an associated profile',
    );
  }

  await assertProfileAccess({
    user,
    profileId: instance.profileId,
    permissions: [
      { decisions: decisionPermission.DEVELOP_PROPOSALS },
      { decisions: permission.ADMIN },
    ],
  });

  const parsedInputs = request.data.inputs;
  const parsedMappings = request.data.mappings;
  const targetSchema = request.data.target;

  for (const ref of [
    ...parsedInputs.map(({ type, phaseId }) => ({ type, phaseId })),
    targetSchema,
  ]) {
    assertSchemaExists({ instanceData: instance.instanceData, ref });
  }

  const mappingInputs = await loadMappingInputs({
    instance,
    inputs: parsedInputs,
  });

  return mapToSchema({
    mappings: parsedMappings,
    inputs: mappingInputs,
    targetSchema,
  });
};

const loadMappingInputs = async ({
  instance,
  inputs,
}: {
  instance: {
    id: string;
    processId: string | null;
    instanceData: DecisionInstanceData;
  };
  inputs: DevelopPrefillInput[];
}): Promise<MappingInput[]> => {
  if (new Set(inputs.map((input) => input.id)).size !== inputs.length) {
    throw new ValidationError('Each input must be given only once');
  }

  const proposalIds = inputs
    .filter((input) => input.type === 'proposal')
    .map((input) => input.id);
  const reviewIds = inputs
    .filter((input) => input.type === 'review')
    .map((input) => input.id);

  const [proposalRows, reviewRows] = await Promise.all([
    proposalIds.length > 0
      ? db.query.proposals.findMany({
          where: {
            id: { in: proposalIds },
            processInstanceId: instance.id,
            deletedAt: { isNull: true },
            moderationDetachedAt: { isNull: true },
          },
          columns: {
            id: true,
            status: true,
            proposalData: true,
            formSchemaId: true,
          },
        })
      : [],
    reviewIds.length > 0
      ? db.query.proposalReviews.findMany({
          where: { id: { in: reviewIds } },
          columns: { id: true, state: true, reviewData: true },
          with: {
            assignment: {
              columns: {
                processInstanceId: true,
                phaseId: true,
                proposalId: true,
              },
            },
          },
        })
      : [],
  ]);

  const proposalsById = new Map(proposalRows.map((row) => [row.id, row]));
  const reviewsById = new Map(reviewRows.map((row) => [row.id, row]));

  for (const input of inputs) {
    if (input.type === 'proposal') {
      const proposal = proposalsById.get(input.id);
      if (!proposal) {
        throw new NotFoundError('Proposal', input.id);
      }
      if (proposal.status === ProposalStatus.DRAFT) {
        throw new ValidationError(
          `Proposal '${input.id}' is a draft and cannot be developed`,
        );
      }
      continue;
    }

    const review = reviewsById.get(input.id);
    if (!review || review.assignment.processInstanceId !== instance.id) {
      throw new NotFoundError('Review', input.id);
    }
    if (review.assignment.phaseId !== input.phaseId) {
      throw new ValidationError(
        `Review '${input.id}' belongs to phase '${review.assignment.phaseId}', not '${input.phaseId}'`,
      );
    }
    if (review.state !== ProposalReviewState.SUBMITTED) {
      throw new ValidationError(
        `Review '${input.id}' is not submitted and cannot be developed`,
      );
    }
    if (!proposalsById.has(review.assignment.proposalId)) {
      throw new ValidationError(
        `Review '${input.id}' is of a proposal that is not among the inputs`,
      );
    }
  }

  const proposalDataById = await getAssembledProposalData({
    instance,
    proposals: proposalRows,
  });

  return inputs.map((input) => ({
    schema: { type: input.type, phaseId: input.phaseId },
    data:
      input.type === 'proposal'
        ? proposalDataById.get(input.id)
        : reviewsById.get(input.id)?.reviewData,
  }));
};

/**
 * The flat data the proposal validator reads: the document fragments
 * assembled under the template the proposal was written under, or the stored
 * data of a legacy proposal without a collaboration document.
 */
const getAssembledProposalData = async ({
  instance,
  proposals,
}: {
  instance: { processId: string | null; instanceData: DecisionInstanceData };
  proposals: Array<{
    id: string;
    proposalData: unknown;
    formSchemaId: string | null;
  }>;
}): Promise<Map<string, unknown>> => {
  const templateFor = await resolveProposalTemplatesByFormSchemaId({
    formSchemaIds: proposals.map((proposal) => proposal.formSchemaId),
    instanceData: instance.instanceData,
    processId: instance.processId,
  });

  const documents = await getProposalDocumentsContent(
    proposals.map((proposal) => ({
      id: proposal.id,
      proposalData: proposal.proposalData,
      proposalTemplate: templateFor(proposal.formSchemaId),
      collaborationDocVersionId: parseProposalData(proposal.proposalData)
        .collaborationDocVersionId,
    })),
    { onFetchError: 'unavailable' },
  );

  return new Map(
    proposals.map((proposal) => {
      const document = documents.get(proposal.id);
      if (document?.type === 'unavailable') {
        throw new NotFoundError('Proposal document', proposal.id);
      }
      if (document?.type !== 'json') {
        return [proposal.id, parseProposalData(proposal.proposalData)];
      }

      const proposalTemplate = templateFor(proposal.formSchemaId);
      return [
        proposal.id,
        resolveDocumentFieldValues({
          fragments: document.fragments,
          proposalTemplate,
          keys: Object.keys(proposalTemplate?.properties ?? {}),
        }),
      ];
    }),
  );
};

// The phase template resolvers fall back to the instance template for an
// unknown phase, so the phase is asserted first.
const assertSchemaExists = ({
  instanceData,
  ref,
}: {
  instanceData: DecisionInstanceData;
  ref: SchemaRef;
}): void => {
  assertInstancePhase({ instance: { instanceData }, phaseId: ref.phaseId });

  const schema =
    ref.type === 'review'
      ? getPhaseRubricTemplate(instanceData, ref.phaseId)
      : getPhaseProposalTemplate(instanceData, ref.phaseId);
  if (!schema) {
    throw new NotFoundError(
      ref.type === 'review' ? 'Rubric' : 'Proposal form',
      undefined,
      `Phase '${ref.phaseId}' has no ${ref.type === 'review' ? 'rubric' : 'proposal form'}`,
    );
  }
};

const toValidationError = (error: z.ZodError): ValidationError => {
  const fieldErrors = Object.fromEntries(
    error.issues.map((issue) => [issue.path.join('.'), issue.message]),
  );
  const [first] = error.issues;
  return new ValidationError(
    first
      ? `Invalid ${first.path.join('.') || 'request'}: ${first.message}`
      : 'Invalid request',
    fieldErrors,
  );
};
