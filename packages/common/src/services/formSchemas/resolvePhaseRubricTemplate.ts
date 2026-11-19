import type { DbClient } from '@op/db/client';

import type { RubricTemplateSchema } from '../decision/types';
import {
  type RubricInstanceData,
  getPhaseRubricFormSchemaId,
  getPhaseRubricTemplate,
} from '../decision/utils/phaseTemplates';
import { getFormSchema } from './getFormSchema';

/**
 * The rubric in effect for `phaseId`, read from the `form_schemas` head when
 * the instance has a pointer and from the inline `rubricTemplate` when it
 * does not.
 *
 * A pointer whose row is missing throws (`getFormSchema`) rather than falling
 * back: the inline copy is dual-written today, so a silent fallback would
 * read answers against a schema the row was never stamped with, and hide the
 * broken pointer instead of surfacing it.
 *
 * Server-only. The synchronous `getPhaseRubricTemplate` stays the client-safe
 * path — it is re-exported through `@op/common/client`, which cannot reach the
 * database.
 */
export async function resolvePhaseRubricTemplate(
  instanceData: RubricInstanceData,
  phaseId: string | undefined,
  tx?: DbClient,
): Promise<RubricTemplateSchema | null> {
  const headId = getPhaseRubricFormSchemaId(instanceData, phaseId);

  if (headId) {
    const version = await getFormSchema(headId, tx);
    return version.schema as RubricTemplateSchema;
  }

  return getPhaseRubricTemplate(instanceData, phaseId);
}
