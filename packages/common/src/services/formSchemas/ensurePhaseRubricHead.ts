import { type DbClient, db, eq, sql } from '@op/db/client';
import { processInstances } from '@op/db/schema';

import { NotFoundError } from '../../utils';
import type { DecisionInstanceData } from '../decision/schemas/instanceData';
import { resolveRubricOwner } from '../decision/utils/phaseTemplates';
import { createFormSchemaVersion } from './createFormSchemaVersion';

/**
 * The `form_schemas` head for the rubric in effect in `phaseId`, minting a
 * lineage root from the inline `rubricTemplate` the first time it is asked.
 * `null` when the phase resolves to no rubric at all.
 *
 * Lazy on purpose: every rubric predates this table, and a review write is
 * the first moment that actually needs the id. Idempotent, so a stale cached
 * `instanceData` (the pointer is minted from a fresh in-transaction read, not
 * from the argument) costs a repeated no-op rather than a second root — the
 * insert is content-addressed and the pointer write sets the same id.
 */
export async function ensurePhaseRubricHead(
  instance: { id: string },
  phaseId: string | undefined,
  tx?: DbClient,
): Promise<string | null> {
  const client = tx ?? db;

  // Re-read rather than trust the argument: `getInstance` serves a cached row
  // that can lag a pointer another request already wrote, and writing a second
  // root over it would strand every review stamped with the first.
  const row = await client.query.processInstances.findFirst({
    where: { id: instance.id },
    columns: { instanceData: true },
  });

  if (!row) {
    throw new NotFoundError('Process instance', instance.id);
  }

  const instanceData = row.instanceData as DecisionInstanceData;
  const owner = resolveRubricOwner(instanceData, phaseId);

  if (owner.formSchemaId) {
    return owner.formSchemaId;
  }

  if (!owner.template) {
    return null;
  }

  const version = await createFormSchemaVersion(
    { schema: owner.template as Record<string, unknown>, parentId: null },
    client,
  );

  // `jsonb_set` on the one key instead of writing the whole blob back: this
  // runs inside someone else's review transaction, and a read-modify-write of
  // `instance_data` would clobber a concurrent admin edit to any other field.
  const path =
    owner.level === 'phase'
      ? sql`ARRAY['phases', ${indexOfPhase(instanceData, phaseId)}::text, 'rubricFormSchemaId']`
      : sql`ARRAY['rubricFormSchemaId']`;

  await client
    .update(processInstances)
    .set({
      instanceData: sql`jsonb_set(${processInstances.instanceData}, ${path}, to_jsonb(${version.id}::text), true)`,
    })
    .where(eq(processInstances.id, instance.id));

  return version.id;
}

function indexOfPhase(
  instanceData: DecisionInstanceData,
  phaseId: string | undefined,
): number {
  const index = instanceData.phases?.findIndex(
    (phase) => phase.phaseId === phaseId,
  );
  if (index == null || index < 0) {
    throw new NotFoundError('Process instance phase', phaseId ?? '(none)');
  }
  return index;
}
