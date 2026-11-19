import { type DbClient, db, isNull } from '@op/db/client';
import { type FormSchema, formSchemas } from '@op/db/schema';
import { and, eq } from 'drizzle-orm';

import { CommonError } from '../../utils';

/**
 * Appends a version to a form-schema lineage and returns the row.
 *
 * Content-addressed, so this is idempotent: saving a schema that already
 * exists under the same parent returns the existing row instead of a
 * duplicate. `ON CONFLICT DO NOTHING` plus a re-read (rather than
 * `DO UPDATE ... RETURNING`) because the row is immutable — there is nothing
 * to update, and a no-op update would churn a row two concurrent savers race
 * for.
 *
 * `parentId` is the version this one supersedes: the lineage head at save
 * time, or `null` to start a lineage.
 */
export async function createFormSchemaVersion(
  {
    schema,
    parentId = null,
    createdByProfileId = null,
  }: {
    schema: Record<string, unknown>;
    parentId?: string | null;
    createdByProfileId?: string | null;
  },
  tx?: DbClient,
): Promise<FormSchema> {
  const client = tx ?? db;

  const [inserted] = await client
    .insert(formSchemas)
    .values({ schema, parentId, createdByProfileId })
    .onConflictDoNothing({
      target: [formSchemas.parentId, formSchemas.schemaHash],
    })
    .returning();

  if (inserted) {
    return inserted;
  }

  // The conflict target already holds this (parent, schema) pair, so read it
  // back. Matching on the jsonb column rather than on `schema_hash`: the hash
  // is generated from the *stored* value, and re-deriving it here would mean
  // hashing a jsonb literal — a hand-built `md5($1::jsonb::text)` gets a
  // double-encoded JSON string from the driver and matches nothing. `jsonb =`
  // is the same equality the generated hash stands for, and drizzle maps the
  // parameter through the column's own encoder.
  const [existing] = await client
    .select()
    .from(formSchemas)
    .where(
      and(
        parentId === null
          ? isNull(formSchemas.parentId)
          : eq(formSchemas.parentId, parentId),
        eq(formSchemas.schema, schema),
      ),
    )
    .limit(1);

  if (!existing) {
    throw new CommonError('Failed to create form schema version');
  }

  return existing;
}
