import { and, db, eq, isNull } from '@op/db/client';
import { customForms, processInstances } from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { NotFoundError } from '../../utils';
import type { CustomFormProcessContext } from './customFormAuth';
import { assertCustomFormAdminForInstance } from './customFormAuth';

/**
 * One round trip for both rows. Authorizing needs the form's `profileId`, so
 * the two reads can't run in parallel — the join removes the second instead.
 */
export const loadFormForWrite = async ({
  id,
  user,
}: {
  id: string;
  user: User;
}): Promise<{ formId: string; process: CustomFormProcessContext }> => {
  const [row] = await db
    .select({
      formId: customForms.id,
      formProfileId: customForms.profileId,
      instanceProfileId: processInstances.profileId,
      ownerProfileId: processInstances.ownerProfileId,
      instanceData: processInstances.instanceData,
    })
    .from(customForms)
    .leftJoin(
      processInstances,
      eq(processInstances.profileId, customForms.profileId),
    )
    .where(and(eq(customForms.id, id), isNull(customForms.deletedAt)))
    .limit(1);

  if (!row) {
    throw new NotFoundError('Custom form', id);
  }

  if (!row.instanceProfileId) {
    throw new NotFoundError('Decision process', row.formProfileId);
  }

  const process = await assertCustomFormAdminForInstance({
    user,
    instance: {
      profileId: row.instanceProfileId,
      ownerProfileId: row.ownerProfileId,
      instanceData: row.instanceData,
    },
  });

  return { formId: row.formId, process };
};
