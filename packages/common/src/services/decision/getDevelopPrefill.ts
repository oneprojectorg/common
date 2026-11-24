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
import { assertDevelopSources } from './assertDevelopSources';
import { assertProposalDevelopAccess } from './assertProposalDevelopAccess';
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
  resolveProposalTemplate,
  resolveProposalTemplates,
} from './resolveProposalTemplate';
import type { PhaseInstanceData } from './schemas/instanceData';
import type { ProposalTemplateSchema } from './types';
import { assertInstancePhase } from './utils/instance';

/**
 * A review's phase is its assignment's phase, so a review input names none. A
 * proposal input names a phase only because a mapping names its source schema
 * as `{ type, phaseId }`. Once schemas have stable ids, the row gives its
 * schema (the proposal's `form_schema_id`, the review's rubric), and both
 * inputs become `{ type, id }`.
 */
export type DevelopPrefillInput =
  | { type: 'proposal'; phaseId: string; id: string }
  | { type: 'review'; id: string };

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
      z.discriminatedUnion('type', [
        z.strictObject({
          type: z.literal('proposal'),
          phaseId: z.string().min(1),
          id: z.uuid(),
        }),
        z.strictObject({ type: z.literal('review'), id: z.uuid() }),
      ]),
    )
    .min(1),
  mappings: z.array(schemaMappingSchema),
});

/**
 * Maps the given proposals and their reviews into the proposal form of the
 * develop phase `target.phaseId`; a target field whose inputs disagree stays
 * empty. A caller that has already asserted develop access and validated the
 * sources calls `buildDevelopPrefill`.
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
  assertValidRequest({ inputs, mappings });

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
        inputs
          .filter((input) => input.type === 'proposal')
          .map((input) => input.id),
      ),
    ],
  });

  return buildDevelopPrefill({
    instance,
    phases,
    targetPhase,
    inputs,
    mappings,
    user,
  });
};

/**
 * `getDevelopPrefill` after `assertProposalDevelopAccess` and
 * `assertDevelopSources`. It still applies the proposal read gate.
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
  assertValidRequest({ inputs, mappings });
  if (!instance.profileId) {
    throw new UnauthorizedError("You don't have access to do this");
  }

  for (const input of inputs) {
    if (input.type === 'proposal') {
      assertInstancePhase({ instance: { phases }, phaseId: input.phaseId });
    }
  }

  const targetSchema: SchemaRef = {
    type: 'proposal',
    phaseId: targetPhase.phaseId,
  };

  const [targetForm, decisionRoles] = await Promise.all([
    // The form a proposal stamped with the phase's `formSchemaId` is read
    // under; `createDevelopedProposal` stamps it.
    resolveProposalTemplate(
      instance.instanceData,
      instance.processId,
      targetPhase.formSchemaId,
    ),
    getProfileAccessRoles({ user, profileId: instance.profileId }),
  ]);
  assertTargetFields({
    targetForm,
    targetSchema,
    mappings,
  });

  const mappingInputs = await loadMappingInputs({
    instance,
    inputs,
    readContext: getProposalReadContext({ user, decisionRoles }),
  });

  // Two sources with equal totals would fill one source's total, and how the
  // totals of several sources combine is not decided yet.
  const sourceCount = inputs.filter(
    (input) => input.type === 'proposal',
  ).length;

  return mapToSchema({
    mappings: sourceCount > 1 ? getCopyRules(mappings) : mappings,
    inputs: mappingInputs,
    targetSchema,
  });
};

const getCopyRules = (mappings: SchemaMapping[]): SchemaMapping[] =>
  mappings.flatMap((mapping) => {
    const fields = mapping.fields.filter(
      (field) => typeof field.from === 'string',
    );
    return fields.length > 0 ? [{ ...mapping, fields }] : [];
  });

const assertValidRequest = (request: {
  inputs: DevelopPrefillInput[];
  mappings: SchemaMapping[];
}): void => {
  if (!developPrefillRequestSchema.validate(request)) {
    throw new ValidationError('Invalid develop prefill request');
  }
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
          // Develop access is enough to read these reviews, unlike other review
          // reads (decisions ADMIN): accepted, as the mappings pick the fields.
          where: {
            id: { in: reviewIds },
            state: ProposalReviewState.SUBMITTED,
            assignment: { processInstanceId: instance.id },
          },
          columns: { id: true, reviewData: true },
          with: {
            assignment: { columns: { phaseId: true, proposalId: true } },
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

  for (const input of proposalInputs) {
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
  }

  const refusedReviewIds = reviewIds.filter((id) => !reviewsById.has(id));
  if (refusedReviewIds.length > 0) {
    throw new ValidationError(
      `These reviews cannot be developed: ${refusedReviewIds.join(', ')}`,
    );
  }
  for (const review of reviewRows) {
    if (!proposalsById.has(review.assignment.proposalId)) {
      throw new ValidationError(
        `Review '${review.id}' is of a proposal that is not among the inputs`,
      );
    }
  }

  const proposalDataById = await getAssembledProposalData({
    instance,
    proposals: proposalRows,
  });

  return inputs.map((input): MappingInput => {
    if (input.type === 'proposal') {
      return {
        schema: { type: 'proposal', phaseId: input.phaseId },
        data: proposalDataById.get(input.id),
      };
    }
    const review = reviewsById.get(input.id);
    if (!review) {
      throw new ValidationError(
        `These reviews cannot be developed: ${input.id}`,
      );
    }
    return {
      schema: { type: 'review', phaseId: review.assignment.phaseId },
      data: review.reviewData,
    };
  });
};

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
 * The document assembled under the proposal's own template. No document, or
 * one that cannot be fetched, gives no data; the other inputs still fill it.
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
  const templateFor = await resolveProposalTemplates({
    proposals,
    instance,
  });

  const documents = await getProposalDocumentsContent(
    proposals.map((proposal) => ({
      id: proposal.id,
      proposalData: proposal.proposalData,
      proposalTemplate: templateFor(proposal.id),
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
        return [proposal.id, {}];
      }

      const proposalTemplate = templateFor(proposal.id);
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
