import { db } from '@op/db/client';
import type { User } from '@op/supabase/lib';

import { NotFoundError } from '../../utils';
import type { CustomFormProcessContext } from './customFormAuth';
import { assertCustomFormAdmin } from './customFormAuth';

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
