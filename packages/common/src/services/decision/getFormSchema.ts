import { db } from '@op/db/client';
import type { FormSchema } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { NotFoundError } from '../../utils';
import { assertInstanceProfileAccess } from '../access';

/**
 * Returns one form schema row. Gated on decisions READ on the row's instance
 * (or the owning org), as `getProposal` is.
 */
export async function getFormSchema({
  formSchemaId,
  user,
}: {
  formSchemaId: string;
  user: User;
}): Promise<FormSchema> {
  const row = await db.query.formSchemas.findFirst({
    where: { id: formSchemaId },
    with: {
      processInstance: {
        columns: { profileId: true, ownerProfileId: true },
      },
    },
  });

  if (!row) {
    throw new NotFoundError('Form schema', formSchemaId);
  }

  const { processInstance, ...formSchema } = row;

  await assertInstanceProfileAccess({
    user,
    instance: processInstance,
    profilePermissions: { decisions: permission.READ },
    orgFallbackPermissions: [
      { decisions: permission.READ },
      { decisions: permission.ADMIN },
    ],
  });

  return formSchema;
}
