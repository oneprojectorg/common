import type { User } from '@op/supabase/lib';
import type { TranslatableEntry } from '@op/translation';

import { parseSchemaOptions } from '../decision/proposalDataSchema';
import { assertReviewAssignmentContext } from '../decision/reviewHelpers';
import type { SupportedLocale } from './locales';
import { runTranslateBatch } from './runTranslateBatch';
import type { TranslatedFields } from './translatedFields';
import { unflattenTranslatedFields } from './translatedFields';

/**
 * Translates the rubric a review assignment is scored against — every
 * criterion's prompt and description, plus each dropdown option's label and
 * description.
 *
 * The result is keyed the same way `translateProposal` keys a proposal's
 * template metadata (`field_title:` / `field_desc:` / `option:` /
 * `option_desc:`), so callers run it through the shared
 * {@link parseTranslatedMeta} to get the per-criterion maps back.
 */
export async function translateRubric({
  assignmentId,
  targetLocale,
  user,
}: {
  assignmentId: string;
  targetLocale: SupportedLocale;
  user: User;
}): Promise<{
  translated: TranslatedFields;
  sourceLocale: string;
  targetLocale: SupportedLocale;
}> {
  // Authorizes the caller against the assignment (reviewer or admin) and
  // resolves the rubric of the phase the assignment belongs to.
  const { assignment, instance, rubricTemplate } =
    await assertReviewAssignmentContext({ assignmentId, user });

  if (!rubricTemplate?.properties) {
    return { translated: {}, sourceLocale: '', targetLocale };
  }

  // Keyed by phase, not by assignment: every reviewer of a phase scores against
  // the same rubric, so they share one cache entry rather than one each.
  const prefix = `rubric:${instance.id}:${assignment.phaseId}:`;
  const entries: TranslatableEntry[] = [];

  for (const [criterionKey, property] of Object.entries(
    rubricTemplate.properties,
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

  if (entries.length === 0) {
    return { translated: {}, sourceLocale: '', targetLocale };
  }

  const results = await runTranslateBatch(entries, targetLocale);

  return {
    ...unflattenTranslatedFields(prefix, results),
    targetLocale,
  };
}
