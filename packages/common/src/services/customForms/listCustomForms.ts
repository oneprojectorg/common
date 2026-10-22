import { db } from '@op/db/client';
import type { CustomForm } from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { assertCustomFormAdmin } from './customFormAuth';
import type { ListCustomFormsInput } from './schemas/customForm';
import { getEffectiveFormPhase } from './utils';

export type CustomFormWithPhase = CustomForm & { phaseId: string | null };

/**
 * The admin read: every definition on a process. Participants get one form for
 * one phase through `getCustomFormForProfile`.
 */
export const listCustomForms = async ({
  data: input,
  user,
}: {
  data: ListCustomFormsInput;
  user: User;
}): Promise<CustomFormWithPhase[]> => {
  // The rows are keyed on the same `profileId` the authorization resolves, so
  // both can be in flight at once. `Promise.all` rejects on a denial before any
  // row is returned.
  const [process, forms] = await Promise.all([
    assertCustomFormAdmin({ user, profileId: input.profileId }),
    db.query.customForms.findMany({
      where: {
        profileId: input.profileId,
        deletedAt: { isNull: true },
      },
      // `createdAt` isn't unique; `id` settles ties.
      orderBy: { createdAt: 'asc', id: 'asc' },
    }),
  ]);

  return forms.map((form) => ({
    ...form,
    phaseId: getEffectiveFormPhase({
      schema: form.schema,
      initialPhaseId: process.initialPhaseId,
    }),
  }));
};
