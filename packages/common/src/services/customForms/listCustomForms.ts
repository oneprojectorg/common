import { db } from '@op/db/client';
import type { CustomForm } from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { assertCustomFormAdmin } from './customFormAuth';
import type { ListCustomFormsInput } from './schemas/customForm';
import { getEffectiveFormPhase } from './utils';

/** A stored form plus the phase it resolves to, so the editor never has to
 *  re-derive the `x-phase`-or-initial-phase rule itself. */
export type CustomFormWithPhase = CustomForm & { phaseId: string | null };

/**
 * Every live form attached to a decision process, oldest first.
 *
 * This is the admin read — it returns all definitions, unlike
 * `getCustomFormForProfile`, which resolves the single form a participant sees
 * in one phase.
 *
 * Authorization: platform admin, or admin on the decision process (see
 * {@link assertCustomFormAdmin}).
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
    // `createdAt` alone isn't unique, so ties would page/render in an arbitrary
    // order; `id` settles them.
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
