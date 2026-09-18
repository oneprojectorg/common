import { and, db, eq, isNull } from '@op/db/client';
import { customForms } from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { loadFormForWrite } from './loadFormForWrite';
import type { DeleteCustomFormInput } from './schemas/customForm';

/**
 * Soft delete: submissions outlive the form, and a deleted definition still has
 * to explain the data collected under it.
 */
export const deleteCustomForm = async ({
  data: input,
  user,
}: {
  data: DeleteCustomFormInput;
  user: User;
}): Promise<{ deletedId: string; profileId: string }> => {
  const { formId, process } = await loadFormForWrite({ id: input.id, user });

  // `deletedAt IS NULL` so a concurrent delete doesn't move the timestamp twice.
  await db
    .update(customForms)
    .set({ deletedAt: new Date().toISOString() })
    .where(and(eq(customForms.id, formId), isNull(customForms.deletedAt)));

  return { deletedId: formId, profileId: process.profileId };
};
