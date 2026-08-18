import type { TranslatableEntry } from '@op/translation';

import { parseSchemaOptions } from '../decision/proposalDataSchema';
import type { RubricTemplateSchema } from '../decision/types';

/**
 * The translatable copy of a rubric, keyed by phase.
 *
 * Keyed by phase and not by assignment: every reviewer of a phase scores
 * against the same rubric, so they share one cache entry rather than one each.
 * That also lets a caller who has no assignment to name — the admin review
 * summary — read the same entries the reviewers' screen wrote.
 *
 * The keys match how `translateProposal` keys a proposal's template metadata
 * (`field_title:` / `field_desc:` / `option:` / `option_desc:`), so callers run
 * the result through the shared `parseTranslatedMeta`.
 */
export function buildRubricEntries({
  instanceId,
  phaseId,
  rubricTemplate,
}: {
  instanceId: string;
  phaseId: string | null | undefined;
  rubricTemplate: RubricTemplateSchema | null | undefined;
}): { prefix: string; entries: TranslatableEntry[] } {
  const prefix = `rubric:${instanceId}:${phaseId}:`;
  const entries: TranslatableEntry[] = [];

  for (const [criterionKey, property] of Object.entries(
    rubricTemplate?.properties ?? {},
  )) {
    if (property.title) {
      entries.push({
        contentKey: `${prefix}field_title:${criterionKey}`,
        text: property.title,
      });
    }
    if (property.description) {
      entries.push({
        contentKey: `${prefix}field_desc:${criterionKey}`,
        text: property.description,
      });
    }

    for (const option of parseSchemaOptions(property)) {
      if (option.title) {
        entries.push({
          contentKey: `${prefix}option:${criterionKey}:${option.value}`,
          text: option.title,
        });
      }
      if (option.description) {
        entries.push({
          contentKey: `${prefix}option_desc:${criterionKey}:${option.value}`,
          text: option.description,
        });
      }
    }
  }

  return { prefix, entries };
}
