import { and, db, eq, inArray } from '@op/db/client';
import { ProposalReviewState } from '@op/db/schema';
import { logger } from '@op/logging';
import type { User } from '@op/supabase/lib';
import { z } from 'zod';

import {
  type MappingInput,
  type MappingResult,
  type SchemaMapping,
  type SchemaRef,
  mapToSchema,
  schemaMappingSchema,
} from '../../schemaMapping';
import { NotFoundError, UnauthorizedError, ValidationError } from '../../utils';
import { getProfileAccessRoles } from '../access';
import { assertProposalDevelopAccess } from './assertProposalDevelopAccess';
import { assertDevelopSources } from './createDevelopedProposal';
import { getProposalDocumentsContent } from './getProposalDocumentsContent';
import { getProposalIdsForPhase } from './getProposalsForPhase';
import { getPhases } from './instancePhases';
import { parseProposalData } from './proposalDataSchema';
import { resolveDocumentFieldValues } from './proposalListPreview';
import {
  type ProposalReadContext,
  getProposalReadContext,
  isProposalReadable,
} from './proposalVisibility';
import {
  resolvePhaseProposalTemplate,
  resolveProposalTemplatesByFormSchemaId,
} from './resolveProposalTemplate';
import type { PhaseInstanceData } from './schemas/instanceData';
import type { ProposalTemplateSchema } from './types';
import { assertInstancePhase } from './utils/instance';

export type DevelopPrefillInput = {
  type: 'proposal' | 'review';
  phaseId: string;
  id: string;
};

/** The `processInstances` columns the prefill reads. */
export type DevelopPrefillInstance = {
  id: string;
  profileId: string | null;
  processId: string | null;
  currentStateId: string | null;
  instanceData: unknown;
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
  mappings: z.array(schemaMappingSchema),
});

/**
 * Builds the starting data of a developed proposal: maps the given proposals
 * and their reviews into the proposal form of the develop phase
 * `target.phaseId` with `mappings`. A target field whose inputs give
 * different values stays empty.
 *
 * Asserts develop access on the target phase and validates the source
 * proposals. A caller that has already done both calls `buildDevelopPrefill`.
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
  const request = parseRequest({ inputs, mappings });

  const instance = await db.query.processInstances.findFirst({
    where: { id: instanceId },
    columns: {
      id: true,
      profileId: true,
      processId: true,
      currentStateId: true,
      instanceData: true,
    },
  });
  if (!instance) {
    throw new NotFoundError('Process instance', instanceId);
  }

  const phases = await getPhases({ instance });

  const targetPhase = await assertProposalDevelopAccess({
    instance: { profileId: instance.profileId, phases },
    phaseId: target.phaseId,
    user,
  });

  await assertDevelopSources({
    instance,
    sourceProposalIds: [
      ...new Set(
        request.inputs
          .filter((input) => input.type === 'proposal')
          .map((input) => input.id),
      ),
    ],
  });

  return buildDevelopPrefill({
    instance,
    phases,
    targetPhase,
    inputs: request.inputs,
    mappings: request.mappings,
    user,
  });
};

/**
 * `getDevelopPrefill` for a caller that has already asserted develop access on
 * `targetPhase` (`assertProposalDevelopAccess` returns the phase) and
 * validated the source proposals (`assertDevelopSources`). It still applies
 * the proposal read gate, and checks that each input belongs to the instance
 * and to the phase it is claimed for.
 */
export const buildDevelopPrefill = async ({
  instance,
  phases,
  targetPhase,
  inputs,
  mappings,
  user,
}: {
  instance: DevelopPrefillInstance;
  /** The instance's resolved phases (`getPhases`). */
  phases: PhaseInstanceData[];
  targetPhase: PhaseInstanceData;
  inputs: DevelopPrefillInput[];
  mappings: SchemaMapping[];
  user: User;
}): Promise<MappingResult> => {
  const request = parseRequest({ inputs, mappings });
  if (!instance.profileId) {
    throw new UnauthorizedError("You don't have access to do this");
  }

  for (const input of request.inputs) {
    assertInstancePhase({ instance: { phases }, phaseId: input.phaseId });
  }

  const targetSchema: SchemaRef = {
    type: 'proposal',
    phaseId: targetPhase.phaseId,
  };

  const [targetForm, decisionRoles] = await Promise.all([
    resolvePhaseProposalTemplate({
      phase: targetPhase,
      instanceData: instance.instanceData,
      processId: instance.processId,
    }),
    getProfileAccessRoles({ user, profileId: instance.profileId }),
  ]);
  assertTargetFields({
    targetForm,
    targetSchema,
    mappings: request.mappings,
  });

  const mappingInputs = await loadMappingInputs({
    instance,
    inputs: request.inputs,
    readContext: getProposalReadContext({ user, decisionRoles }),
  });

  return mapToSchema({
    mappings: request.mappings,
    inputs: mappingInputs,
    targetSchema,
  });
};

const parseRequest = (request: {
  inputs: DevelopPrefillInput[];
  mappings: SchemaMapping[];
}): z.infer<typeof developPrefillRequestSchema> => {
  const result = developPrefillRequestSchema.safeParse(request);
  if (!result.success) {
    throw toValidationError(result.error);
  }
  return result.data;
};

/** Each field a mapping writes into the target must be a field of its form. */
const assertTargetFields = ({
  targetForm,
  targetSchema,
  mappings,
}: {
  targetForm: ProposalTemplateSchema | null;
  targetSchema: SchemaRef;
  mappings: SchemaMapping[];
}): void => {
  if (!targetForm) {
    throw new NotFoundError(
      'Proposal form',
      undefined,
      `Phase '${targetSchema.phaseId}' has no proposal form`,
    );
  }

  const properties = targetForm.properties ?? {};
  for (const mapping of mappings) {
    if (
      mapping.to.type !== targetSchema.type ||
      mapping.to.phaseId !== targetSchema.phaseId
    ) {
      continue;
    }
    const unknownField = mapping.fields.find(
      (field) => !Object.hasOwn(properties, field.to),
    );
    if (unknownField) {
      throw new ValidationError(
        `Target field '${unknownField.to}' is not a field of the proposal form of phase '${targetSchema.phaseId}'`,
      );
    }
  }
};

const loadMappingInputs = async ({
  instance,
  inputs,
  readContext,
}: {
  instance: DevelopPrefillInstance;
  inputs: DevelopPrefillInput[];
  readContext: ProposalReadContext;
}): Promise<MappingInput[]> => {
  if (new Set(inputs.map((input) => input.id)).size !== inputs.length) {
    throw new ValidationError('Each input must be given only once');
  }

  const proposalInputs = inputs.filter((input) => input.type === 'proposal');
  const proposalIds = proposalInputs.map((input) => input.id);
  const reviewIds = inputs
    .filter((input) => input.type === 'review')
    .map((input) => input.id);

  const [proposalRows, reviewRows, proposalIdsByPhase] = await Promise.all([
    proposalIds.length > 0
      ? db.query.proposals.findMany({
          // A proposal the caller cannot read is absent, so it 404s below.
          where: {
            RAW: (table) =>
              and(
                inArray(table.id, proposalIds),
                eq(table.processInstanceId, instance.id),
                isProposalReadable(table, readContext),
              )!,
          },
          columns: {
            id: true,
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
    getProposalIdsByPhase({
      instance,
      phaseIds: proposalInputs.map((input) => input.phaseId),
    }),
  ]);

  const proposalsById = new Map(proposalRows.map((row) => [row.id, row]));
  const reviewsById = new Map(reviewRows.map((row) => [row.id, row]));

  for (const input of inputs) {
    if (input.type === 'proposal') {
      if (!proposalsById.has(input.id)) {
        throw new NotFoundError('Proposal', input.id);
      }
      // Phase membership admits only phase-eligible proposals, so this also
      // refuses a draft.
      if (!proposalIdsByPhase.get(input.phaseId)?.has(input.id)) {
        throw new ValidationError(
          `Proposal '${input.id}' is not in phase '${input.phaseId}'`,
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

/** The ids of the proposals in each of `phaseIds`, by phase. */
const getProposalIdsByPhase = async ({
  instance,
  phaseIds,
}: {
  instance: DevelopPrefillInstance;
  phaseIds: string[];
}): Promise<Map<string, Set<string>>> =>
  new Map(
    await Promise.all(
      [...new Set(phaseIds)].map(
        async (phaseId): Promise<[string, Set<string>]> => [
          phaseId,
          new Set(await getProposalIdsForPhase({ instance, phaseId })),
        ],
      ),
    ),
  );

/**
 * The flat data the proposal validator reads: the document fragments
 * assembled under the template the proposal was written under, or the stored
 * data of a legacy proposal without a collaboration document. A proposal whose
 * document cannot be fetched gives no data, so the other inputs still fill
 * the target.
 */
const getAssembledProposalData = async ({
  instance,
  proposals,
}: {
  instance: DevelopPrefillInstance;
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
        logger.warn(
          'Develop prefill skipped an unavailable proposal document',
          {
            proposalId: proposal.id,
          },
        );
        return [proposal.id, {}];
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
