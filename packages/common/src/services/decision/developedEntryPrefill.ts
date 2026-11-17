import {
  type FragmentCopy,
  encodeFragmentCopies,
  getTipTapClient,
} from '@op/collab';
import { db } from '@op/db/client';
import { logger } from '@op/logging';
import type { User } from '@op/supabase/lib';

import type { SchemaMapping } from '../../schemaMapping';
import { NotFoundError, ValidationError } from '../../utils';
import {
  type DevelopPrefillInstance,
  buildDevelopPrefill,
} from './getDevelopPrefill';
import { getDevelopPrefillMappings } from './getDevelopPrefillMappings';
import {
  PROPOSAL_TITLE_MAX_LENGTH,
  normalizeProposalCategories,
  parseProposalData,
} from './proposalDataSchema';
import type { PhaseInstanceData } from './schemas/instanceData';
import { getPreviousPhases } from './utils/phaseOrder';

/** What a new developed proposal starts with, from its sources. */
export type DevelopedEntryPrefill = {
  /** The mapped title as plain text, for the proposal's name. */
  title?: string;
  category?: string[];
  /** The new collaboration document, copied from the sources' fragments. */
  documentUpdate: Uint8Array<ArrayBuffer> | null;
};

/**
 * Maps the sources into the form of the develop phase with the phase's
 * prefill mappings. Each mapped field whose rule reads a top-level source
 * field is copied as it is, as the source document's fragment; nothing is
 * cut to the target's constraints.
 *
 * Best effort: no mappings, or a prefill that fails, gives null and the entry
 * is created without a prefill. The caller has asserted develop access and
 * validated the sources.
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
    ({ data } = await buildDevelopPrefill({
      instance,
      phases,
      targetPhase: developPhase,
      inputs: sourceProposalIds.map((id) => ({
        type: 'proposal',
        phaseId: sourcePhaseId,
        id,
      })),
      mappings,
      user,
    }));
  } catch (error) {
    // A refused mapping or input points at the config (a target field the
    // form lacks, a missing form) or a source outside the source phase; it
    // fails every create alike, so it must be seen.
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

  const title =
    typeof data.title === 'string'
      ? data.title
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, PROPOSAL_TITLE_MAX_LENGTH)
          .trim()
      : '';
  const category = normalizeProposalCategories(data.category);

  return {
    ...(title ? { title } : {}),
    ...(category.length > 0 ? { category } : {}),
    documentUpdate,
  };
}

/**
 * Creates the entry's collaboration document from the prefill. Never throws:
 * an entry without its seed is still a usable empty entry. An existing
 * document is left as it is.
 */
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

/**
 * The source → target fragment pairs for the mapped keys. A rule whose source
 * is a nested path has no fragment of its own, so it seeds nothing.
 */
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
    .filter((field) => keys.has(field.to) && !field.from.includes('.'));
}

/**
 * Copies each rule's fragment from the first source whose document has it.
 * The mapped data holds a key only when every source agreed on it. Each
 * source document is fetched once; a source without one adds nothing.
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
      return client.getDocumentUpdate(proposalData.collaborationDocId, {
        version: proposalData.collaborationDocVersionId,
      });
    }),
  );

  const copies: FragmentCopy[] = fields.flatMap(({ from, to }) =>
    sourceUpdates.flatMap((sourceUpdate) =>
      sourceUpdate ? [{ sourceUpdate, from, to }] : [],
    ),
  );

  return encodeFragmentCopies(copies);
}
