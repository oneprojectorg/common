import { db } from '@op/db/client';
import { type FormSchema, formSchemas } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { CommonError, NotFoundError, ValidationError } from '../../utils';
import { getCurrentProfileId } from '../access';
import { assertProfileAccess } from '../assert';
import { schemaValidator } from './schemaValidator';

const VERSION_UNIQUE_CONSTRAINT = 'form_schemas_version_uniq';

/**
 * Stores a JSON Schema row for a decision instance. Admins of the instance
 * only. Rows are immutable: pass `parentId` to store a new version of an
 * existing row of the same instance.
 */
export async function createFormSchema({
  processInstanceId,
  name,
  schema,
  parentId,
  user,
}: {
  processInstanceId: string;
  name: string;
  schema: Record<string, unknown>;
  /** The row this one replaces; omit for the first version. */
  parentId?: string;
  user: User;
}): Promise<FormSchema> {
  const instance = await db.query.processInstances.findFirst({
    where: { id: processInstanceId },
    columns: { profileId: true },
  });

  if (!instance) {
    throw new NotFoundError('Process instance', processInstanceId);
  }

  if (!instance.profileId) {
    throw new NotFoundError('Decision profile');
  }

  await assertProfileAccess({
    user: { id: user.id },
    profileId: instance.profileId,
    permissions: { decisions: permission.ADMIN },
  });

  schemaValidator.validateJsonSchema(schema);

  if (parentId) {
    const parent = await db.query.formSchemas.findFirst({
      where: { id: parentId },
      columns: { processInstanceId: true },
    });

    // Same error for another instance's row, so its existence never leaks.
    if (!parent || parent.processInstanceId !== processInstanceId) {
      throw new NotFoundError('Form schema', parentId);
    }
  }

  const createdByProfileId = await getCurrentProfileId(user.id);

  try {
    const [row] = await db
      .insert(formSchemas)
      .values({
        processInstanceId,
        parentId: parentId ?? null,
        name,
        schema,
        createdByProfileId,
      })
      .returning();

    if (!row) {
      throw new CommonError('Failed to create form schema');
    }

    return row;
  } catch (error: unknown) {
    if (isVersionUniqueViolation(error)) {
      throw new ValidationError('An identical form schema already exists');
    }
    throw error;
  }
}

/**
 * True when the error (or a cause it wraps; drizzle wraps the postgres error)
 * is a unique violation on the version constraint.
 */
function isVersionUniqueViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  if (
    'code' in error &&
    error.code === '23505' &&
    'constraint_name' in error &&
    error.constraint_name === VERSION_UNIQUE_CONSTRAINT
  ) {
    return true;
  }

  return 'cause' in error && isVersionUniqueViolation(error.cause);
}
