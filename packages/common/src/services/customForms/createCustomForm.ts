import { db } from '@op/db/client';
import type { CustomForm } from '@op/db/schema';
import { customForms } from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { CommonError } from '../../utils';
import { assertCustomFormAdmin } from './customFormAuth';
import { assertPhaseAvailable, lockProfileForms } from './phaseBinding';
import type { CreateCustomFormInput } from './schemas/customForm';

/**
 * Attaches a new custom form to a decision process, bound to the phase named by
 * its `x-phase`.
 *
 * Authorization: platform admin, or admin on the decision process that owns
 * `profileId` (see {@link assertCustomFormAdmin}).
 */
export const createCustomForm = async ({
  data: input,
  user,
}: {
  data: CreateCustomFormInput;
  user: User;
}): Promise<CustomForm> => {
  const process = await assertCustomFormAdmin({
    user,
    profileId: input.profileId,
  });

  const form = await db.transaction(async (tx) => {
    await lockProfileForms({ tx, profileId: process.profileId });
    await assertPhaseAvailable({
      tx,
      process,
      phaseId: input.schema['x-phase'],
    });

    const [inserted] = await tx
      .insert(customForms)
      .values({
        profileId: process.profileId,
        name: input.name,
        schema: input.schema,
      })
      .returning();

    return inserted;
  });

  if (!form) {
    throw new CommonError('Failed to create the custom form');
  }

  return form;
};
