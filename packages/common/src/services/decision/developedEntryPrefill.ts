import { type SeedFragments, getTipTapClient } from '@op/collab';
import { logger } from '@op/logging';
import type { User } from '@op/supabase/lib';

import { NotFoundError, ValidationError } from '../../utils';
import {
  type DevelopPrefillInstance,
  buildDevelopPrefill,
} from './getDevelopPrefill';
import { getDevelopPrefillMappings } from './getDevelopPrefillMappings';
import {
  getProposalTitleMaxLength,
  normalizeProposalCategories,
} from './proposalDataSchema';
import { resolveProposalTemplate } from './resolveProposalTemplate';
import type { PhaseInstanceData } from './schemas/instanceData';
import type { ProposalTemplateSchema, XFormatPropertySchema } from './types';
import { getPreviousPhases } from './utils/phaseOrder';

/** What a new developed proposal starts with, from its sources. */
export type DevelopedEntryPrefill = {
  /** Capped as the editor caps it. */
  title?: string;
  category?: string[];
  /** Collaboration document fragments, the title's among them. */
  fragments: SeedFragments;
};

/**
 * Maps the sources into the form of the develop phase with the phase's
 * prefill mappings. Only the title, the category and the text fields are
 * kept; a budget is never prefilled.
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

  try {
    const [targetForm, { data }] = await Promise.all([
      resolveProposalTemplate(
        instance.instanceData,
        instance.processId,
        developPhase.formSchemaId,
      ),
      buildDevelopPrefill({
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
      }),
    ]);

    return toEntryPrefill({ data, targetForm });
  } catch (error) {
    const context = {
      error,
      processInstanceId: instance.id,
      phaseId: developPhase.phaseId,
    };
    // A refused mapping or input points at the config (a target field the
    // form lacks, a missing form) or a source outside the source phase; it
    // fails every create alike, so it must be seen.
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      logger.error(
        'Develop prefill refused; creating the entry without it',
        context,
      );
    } else {
      logger.warn(
        'Develop prefill failed; creating the entry without it',
        context,
      );
    }
    return null;
  }
}

/**
 * Creates the entry's collaboration document with the prefilled fragments.
 * Never throws: an entry without its seed is still a usable empty entry. An
 * existing document is left as it is.
 */
export async function seedDevelopedEntryDocument({
  collaborationDocId,
  fragments,
}: {
  collaborationDocId: string | null | undefined;
  fragments: SeedFragments;
}): Promise<void> {
  if (!collaborationDocId || Object.keys(fragments).length === 0) {
    return;
  }

  try {
    await getTipTapClient().createDocument(collaborationDocId, fragments);
  } catch (error) {
    logger.warn('Could not seed the developed entry document', {
      error,
      collaborationDocId,
    });
  }
}

function toEntryPrefill({
  data,
  targetForm,
}: {
  data: Record<string, unknown>;
  targetForm: ProposalTemplateSchema | null;
}): DevelopedEntryPrefill {
  const properties = targetForm?.properties ?? {};
  const prefill: DevelopedEntryPrefill = { fragments: {} };

  for (const [key, value] of Object.entries(data)) {
    const property = properties[key];
    if (!property) {
      continue;
    }

    if (key === 'title') {
      const title =
        typeof value === 'string'
          ? value
              .replace(/\s+/g, ' ')
              .trim()
              .slice(0, getProposalTitleMaxLength(property))
              .trim()
          : '';
      if (title) {
        prefill.title = title;
        prefill.fragments.title = { kind: 'line', text: title };
      }
      continue;
    }

    if (key === 'category') {
      const category = normalizeProposalCategories(value);
      if (category.length > 0) {
        prefill.category = category;
      }
      continue;
    }

    // A legacy budget has no `x-format`, so it is matched by key too.
    if (key === 'budget') {
      continue;
    }

    const text = toFieldText({ value, property });
    if (text) {
      prefill.fragments[key] = { kind: 'paragraphs', text };
    }
  }

  return prefill;
}

/** A text field's value, cut to the field's `maxLength`; empty otherwise. */
function toFieldText({
  value,
  property,
}: {
  value: unknown;
  property: XFormatPropertySchema;
}): string {
  const format = property['x-format'];
  if (
    (format !== 'short-text' && format !== 'long-text') ||
    typeof value !== 'string'
  ) {
    return '';
  }

  const text = value.trim();
  return property.maxLength == null
    ? text
    : text.slice(0, property.maxLength).trim();
}
