import type { TranslatableEntry } from '@op/translation';

import { getTranslatableRubricCopy } from '../decision/rubricTranslatableCopy';
import type { RubricTemplateSchema } from '../decision/types';
import type { SupportedLocale } from './locales';
import { runTranslateBatch } from './runTranslateBatch';
import type { TranslatedFields } from './translatedFields';
import { unflattenTranslatedFields } from './translatedFields';

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
 *
 * Covers the rubric's authored copy only — see `getTranslatableRubricCopy` for
 * what that excludes and why.
 */
function buildRubricEntries({
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

  for (const {
    criterionKey,
    title,
    description,
    options,
  } of getTranslatableRubricCopy(rubricTemplate)) {
    if (title) {
      entries.push({
        contentKey: `${prefix}field_title:${criterionKey}`,
        text: title,
      });
    }
    if (description) {
      entries.push({
        contentKey: `${prefix}field_desc:${criterionKey}`,
        text: description,
      });
    }

    for (const option of options) {
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

/**
 * Builds a rubric's entries, translates them, and returns the per-criterion
 * maps — everything the two rubric services do after resolving their own
 * context.
 *
 * They differ only in how they reach the rubric and what they authorize against
 * (`translateRubric` by assignment, `translatePhaseRubric` by phase). Sharing
 * the body is what keeps their cache keys identical, which is the invariant that
 * lets whichever screen asks first pay for the translation and the other read
 * it.
 */
export async function translateRubricEntries({
  instanceId,
  phaseId,
  rubricTemplate,
  targetLocale,
}: {
  instanceId: string;
  phaseId: string | null | undefined;
  rubricTemplate: RubricTemplateSchema | null | undefined;
  targetLocale: SupportedLocale;
}): Promise<{
  translated: TranslatedFields;
  sourceLocale: string;
  targetLocale: SupportedLocale;
}> {
  const { prefix, entries } = buildRubricEntries({
    instanceId,
    phaseId,
    rubricTemplate,
  });

  if (entries.length === 0) {
    return { translated: {}, sourceLocale: '', targetLocale };
  }

  const results = await runTranslateBatch(entries, targetLocale);

  return {
    ...unflattenTranslatedFields(prefix, results),
    targetLocale,
  };
}
