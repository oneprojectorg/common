import {
  type FragmentCopy,
  encodeFragmentCopies,
  getTipTapClient,
} from '@op/collab';
import { db } from '@op/db/client';
import { ProposalReviewState } from '@op/db/schema';
import { logger } from '@op/logging';
import type { User } from '@op/supabase/lib';

import type { SchemaMapping } from '../../schemaMapping';
import { NotFoundError, ValidationError } from '../../utils';
import {
  type DevelopPrefillInput,
  type DevelopPrefillInstance,
  buildDevelopPrefill,
} from './getDevelopPrefill';
import { getDevelopPrefillMappings } from './getDevelopPrefillMappings';
import {
  PROPOSAL_TITLE_MAX_LENGTH,
  type ProposalDataInput,
  normalizeBudget,
  normalizeLocation,
  normalizeProposalCategories,
  parseProposalData,
} from './proposalDataSchema';
import type { PhaseInstanceData } from './schemas/instanceData';
import { getPreviousPhases } from './utils/phaseOrder';

/** What a new developed proposal starts with, from its sources. */
export type DevelopedEntryPrefill = {
  /** The mapped system fields: title, category, budget and location. */
  proposalData: ProposalDataInput;
  documentUpdate: Uint8Array<ArrayBuffer> | null;
};

/**
 * Maps the sources with the develop phase's prefill mappings. Best effort: a
 * failure is logged and gives null, and the entry is created without it.
 */
export async function getDevelopedEntryPrefill({
  instance,
  phases,
  developPhase,
  sourceProposalIds,
  user,
}: {
  instance: DevelopPrefillInstance;
  /** The instance's resolved phases (`getPhases`). */
  phases: PhaseInstanceData[];
  developPhase: PhaseInstanceData;
  sourceProposalIds: string[];
  user: User;
}): Promise<DevelopedEntryPrefill | null> {
  const mappings = getDevelopPrefillMappings(developPhase);
  // The develop screen offers the phase before the develop phase as sources.
  const sourcePhaseId = getPreviousPhases({ phases }, developPhase.phaseId).at(
    -1,
  )?.phaseId;
  if (mappings.length === 0 || !sourcePhaseId) {
    return null;
  }

  const context = {
    processInstanceId: instance.id,
    phaseId: developPhase.phaseId,
  };

  let data: Record<string, unknown>;
  try {
    const reviewInputs = await getSubmittedReviewInputs({
      instanceId: instance.id,
      mappings,
      developPhaseId: developPhase.phaseId,
      sourceProposalIds,
    });
    ({ data } = await buildDevelopPrefill({
      instance,
      phases,
      targetPhase: developPhase,
      inputs: [
        ...sourceProposalIds.map((id): DevelopPrefillInput => ({
          type: 'proposal',
          phaseId: sourcePhaseId,
          id,
        })),
        ...reviewInputs,
      ],
      mappings,
      user,
    }));
  } catch (error) {
    // A refused mapping or source is a config error that fails every create.
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      logger.error('Develop prefill refused; creating the entry without it', {
        ...context,
        error,
      });
    } else {
      logger.warn('Develop prefill failed; creating the entry without it', {
        ...context,
        error,
      });
    }
    return null;
  }

  let documentUpdate: Uint8Array<ArrayBuffer> | null = null;
  try {
    documentUpdate = await getEntryDocumentUpdate({
      fields: getFragmentRules({
        mappings,
        sourcePhaseId,
        developPhaseId: developPhase.phaseId,
        targetKeys: Object.keys(data),
      }),
      sourceProposalIds,
    });
  } catch (error) {
    logger.warn('Could not copy the develop sources into the entry document', {
      ...context,
      error,
    });
  }

  return {
    proposalData: toSystemFields(
      withoutNumberSums({
        data,
        mappings,
        developPhaseId: developPhase.phaseId,
      }),
    ),
    documentUpdate,
  };
}

/** The submitted reviews of the sources in each phase a review mapping reads. */
async function getSubmittedReviewInputs({
  instanceId,
  mappings,
  developPhaseId,
  sourceProposalIds,
}: {
  instanceId: string;
  mappings: SchemaMapping[];
  developPhaseId: string;
  sourceProposalIds: string[];
}): Promise<DevelopPrefillInput[]> {
  const reviewPhaseIds = [
    ...new Set(
      mappings
        .filter(
          (mapping) =>
            mapping.from.type === 'review' &&
            mapping.to.type === 'proposal' &&
            mapping.to.phaseId === developPhaseId,
        )
        .map((mapping) => mapping.from.phaseId),
    ),
  ];
  if (reviewPhaseIds.length === 0) {
    return [];
  }

  const reviews = await db.query.proposalReviews.findMany({
    where: {
      state: ProposalReviewState.SUBMITTED,
      assignment: {
        processInstanceId: instanceId,
        proposalId: { in: sourceProposalIds },
        phaseId: { in: reviewPhaseIds },
      },
    },
    columns: { id: true },
  });

  return reviews.map((review) => ({ type: 'review', id: review.id }));
}

/**
 * The system fields the editor's autosave stores, through its normalizers.
 * The title is cut only at the hard limit, as it becomes the proposal's name.
 */
function toSystemFields(data: Record<string, unknown>): ProposalDataInput {
  const title =
    typeof data.title === 'string'
      ? data.title
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, PROPOSAL_TITLE_MAX_LENGTH)
          .trim()
      : '';
  const category = normalizeProposalCategories(data.category);
  const budget = normalizeBudget(data.budget);
  const location = normalizeLocation(data.location);

  return {
    ...(title ? { title } : {}),
    ...(category.length > 0 ? { category } : {}),
    ...(budget ? { budget } : {}),
    ...(location ? { location } : {}),
  };
}

/**
 * Drops the result of an `add` rule over plain numbers: it has no currency,
 * and `normalizeBudget` would read the bare number as USD.
 */
function withoutNumberSums({
  data,
  mappings,
  developPhaseId,
}: {
  data: Record<string, unknown>;
  mappings: SchemaMapping[];
  developPhaseId: string;
}): Record<string, unknown> {
  const sumTargets = new Set(
    mappings
      .filter(
        (mapping) =>
          mapping.to.type === 'proposal' &&
          mapping.to.phaseId === developPhaseId,
      )
      .flatMap((mapping) => mapping.fields)
      .flatMap(({ from, to }) => (typeof from === 'string' ? [] : [to])),
  );

  return Object.fromEntries(
    Object.entries(data).filter(
      ([key, value]) => !(sumTargets.has(key) && typeof value === 'number'),
    ),
  );
}

/** Creates the entry's document unless it exists. Never throws. */
export async function seedDevelopedEntryDocument({
  collaborationDocId,
  documentUpdate,
}: {
  collaborationDocId: string | null | undefined;
  documentUpdate: Uint8Array<ArrayBuffer> | null;
}): Promise<void> {
  if (!collaborationDocId || !documentUpdate) {
    return;
  }

  try {
    await getTipTapClient().createDocument(collaborationDocId, documentUpdate);
  } catch (error) {
    logger.warn('Could not seed the developed entry document', {
      error,
      collaborationDocId,
    });
  }
}

/** A rule with a nested source path or an expression has no fragment of its own; it is left out. */
function getFragmentRules({
  mappings,
  sourcePhaseId,
  developPhaseId,
  targetKeys,
}: {
  mappings: SchemaMapping[];
  sourcePhaseId: string;
  developPhaseId: string;
  targetKeys: string[];
}): Array<{ from: string; to: string }> {
  const keys = new Set(targetKeys);

  return mappings
    .filter(
      (mapping) =>
        mapping.from.type === 'proposal' &&
        mapping.from.phaseId === sourcePhaseId &&
        mapping.to.type === 'proposal' &&
        mapping.to.phaseId === developPhaseId,
    )
    .flatMap((mapping) => mapping.fields)
    .flatMap(({ from, to }) =>
      typeof from === 'string' && keys.has(to) && !from.includes('.')
        ? [{ from, to }]
        : [],
    );
}

/**
 * Each source document is fetched once. The mapped data holds a key only when
 * the sources agreed, so the first source that has the fragment fills it.
 */
async function getEntryDocumentUpdate({
  fields,
  sourceProposalIds,
}: {
  fields: Array<{ from: string; to: string }>;
  sourceProposalIds: string[];
}): Promise<Uint8Array<ArrayBuffer> | null> {
  if (fields.length === 0) {
    return null;
  }

  const rows = await db.query.proposals.findMany({
    where: { id: { in: sourceProposalIds } },
    columns: { id: true, proposalData: true },
  });
  const proposalDataById = new Map(
    rows.map((row) => [row.id, parseProposalData(row.proposalData)]),
  );

  const client = getTipTapClient();
  const sourceUpdates = await Promise.all(
    sourceProposalIds.map(async (id) => {
      const proposalData = proposalDataById.get(id);
      if (!proposalData?.collaborationDocId) {
        return null;
      }
      // As in `buildDevelopPrefill`, one unreadable source leaves the rest.
      try {
        return await client.getDocumentUpdate(proposalData.collaborationDocId, {
          version: proposalData.collaborationDocVersionId,
        });
      } catch (error) {
        logger.warn('Develop prefill skipped an unreadable source document', {
          proposalId: id,
          error,
        });
        return null;
      }
    }),
  );

  const copies: FragmentCopy[] = fields.flatMap(({ from, to }) =>
    sourceUpdates.flatMap((sourceUpdate) =>
      sourceUpdate ? [{ sourceUpdate, from, to }] : [],
    ),
  );

  return encodeFragmentCopies(copies);
}
