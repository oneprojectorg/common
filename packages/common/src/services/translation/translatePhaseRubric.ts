import type { User } from '@op/supabase/lib';

import { UnauthorizedError } from '../../utils';
import { getInstance } from '../decision/getInstance';
import { getPhaseRubricTemplate } from '../decision/utils/phaseTemplates';
import type { SupportedLocale } from './locales';
import { translateRubricEntries } from './rubricEntries';
import type { TranslatedFields } from './translatedFields';

/**
 * Translates a phase's rubric for a caller who holds no assignment against it.
 *
 * `translateRubric` addresses the rubric through a review assignment, which is
 * how the reviewer's own screen reaches it. The admin review summary shows the
 * same rubric beside the same proposal but has no assignment of its own, and
 * cannot borrow another reviewer's — assignment reads are self-scoped. Without
 * this the control on that screen could not move the rubric, so the screen
 * offered no control at all and an admin reading a foreign-language rubric was
 * stuck.
 *
 * Gated like the assignment list it stands in for: an instance admin or a
 * reviewer of the instance. The cache keys match `translateRubric` exactly, so
 * whichever screen asks first pays for the translation and the other reads it.
 */
export async function translatePhaseRubric({
  processInstanceId,
  phaseId,
  targetLocale,
  user,
}: {
  processInstanceId: string;
  phaseId: string;
  targetLocale: SupportedLocale;
  user: User;
}): Promise<{
  translated: TranslatedFields;
  sourceLocale: string;
  targetLocale: SupportedLocale;
}> {
  const instance = await getInstance({ instanceId: processInstanceId, user });

  if (!instance.access.admin && !instance.access.review) {
    throw new UnauthorizedError("You don't have access to this rubric");
  }

  return translateRubricEntries({
    instanceId: instance.id,
    phaseId,
    rubricTemplate: getPhaseRubricTemplate(instance.instanceData, phaseId),
    targetLocale,
  });
}
