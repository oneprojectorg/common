import type { User } from '@op/supabase/lib';

import { assertReviewAssignmentContext } from '../decision/reviewHelpers';
import type { SupportedLocale } from './locales';
import { translateRubricEntries } from './rubricEntries';
import type { TranslatedFields } from './translatedFields';

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

  return translateRubricEntries({
    instanceId: instance.id,
    phaseId: assignment.phaseId,
    rubricTemplate,
    targetLocale,
  });
}
