import { and, db, eq, isNull } from '@op/db/client';
import { customForms } from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { NotFoundError } from '../../utils';
import { assertCustomFormAdmin } from './customFormAuth';
import type { DeleteCustomFormInput } from './schemas/customForm';

/**
 * Soft-deletes a custom form, freeing its phase for a new one. Submissions
 * already recorded against it are kept — a deleted definition still has to
 * explain the data collected under it.
 *
 * Returns the profile the form hung off, so the caller can fan invalidation out
 * to it without re-reading a row that no longer lists.
 *
 * Authorization: platform admin, or admin on the decision process that owns the
 * form (see {@link assertCustomFormAdmin}).
 */
export const deleteCustomForm = async ({
  data: input,
  user,
}: {
  data: DeleteCustomFormInput;
  user: User;
}): Promise<{ profileId: string }> => {
  const existing = await db.query.customForms.findFirst({
    where: { id: input.id, deletedAt: { isNull: true } },
    columns: { id: true, profileId: true },
  });

  if (!existing) {
    throw new NotFoundError('Custom form', input.id);
  }

  const process = await assertCustomFormAdmin({
    user,
    profileId: existing.profileId,
  });

  // `deletedAt IS NULL` in the WHERE as well, so a concurrent delete doesn't
  // move the timestamp a second time.
  await db
    .update(customForms)
    .set({ deletedAt: new Date().toISOString() })
    .where(and(eq(customForms.id, existing.id), isNull(customForms.deletedAt)));

  return { profileId: process.profileId };
};
