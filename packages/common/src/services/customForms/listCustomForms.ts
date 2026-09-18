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
  const process = await assertCustomFormAdmin({
    user,
    profileId: input.profileId,
  });

  const forms = await db.query.customForms.findMany({
    where: {
      profileId: process.profileId,
      deletedAt: { isNull: true },
    },
    // `createdAt` isn't unique; `id` settles ties.
    orderBy: { createdAt: 'asc' as const, id: 'asc' as const },
  });

  return forms.map((form) => ({
    ...form,
    phaseId: getEffectiveFormPhase({
      schema: form.schema,
      initialPhaseId: process.initialPhaseId,
    }),
  }));
};
