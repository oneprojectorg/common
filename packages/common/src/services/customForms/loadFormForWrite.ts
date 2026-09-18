import { db } from '@op/db/client';
import type { User } from '@op/supabase/lib';

import { NotFoundError } from '../../utils';
import type { CustomFormProcessContext } from './customFormAuth';
import { assertCustomFormAdmin } from './customFormAuth';

/**
 * Resolves a live form by id and authorizes the caller against the decision
 * process that owns it — the opening move of every write that targets an
 * existing form.
 *
 * @throws NotFoundError when no live form has that id.
 * @throws UnauthorizedError when the caller may not edit the owning process.
 */
export const loadFormForWrite = async ({
  id,
  user,
}: {
  id: string;
  user: User;
}): Promise<{ formId: string; process: CustomFormProcessContext }> => {
  const existing = await db.query.customForms.findFirst({
    where: { id, deletedAt: { isNull: true } },
    columns: { id: true, profileId: true },
  });

  if (!existing) {
    throw new NotFoundError('Custom form', id);
  }

  const process = await assertCustomFormAdmin({
    user,
    profileId: existing.profileId,
  });

  return { formId: existing.id, process };
};
