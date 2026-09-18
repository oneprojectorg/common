import { and, eq, isNull } from '@op/db/client';
import type { CustomForm } from '@op/db/schema';
import { customForms } from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { CommonError } from '../../utils';
import { loadFormForWrite } from './loadFormForWrite';
import { writeWithPhaseLock } from './phaseBinding';
import type { UpdateCustomFormInput } from './schemas/customForm';

/** Submissions already recorded keep the shape they were validated under. */
export const updateCustomForm = async ({
  data: input,
  user,
}: {
  data: UpdateCustomFormInput;
  user: User;
}): Promise<CustomForm> => {
  const { formId, process } = await loadFormForWrite({ id: input.id, user });

  const form = await writeWithPhaseLock({
    process,
    phaseId: input.schema['x-phase'],
    excludeFormId: formId,
    write: async (tx) => {
      // The row could have been deleted between the read above and here.
      const [updated] = await tx
        .update(customForms)
        .set({ name: input.name, schema: input.schema })
        .where(and(eq(customForms.id, formId), isNull(customForms.deletedAt)))
        .returning();

      return updated;
    },
  });

  if (!form) {
    throw new CommonError(
      'The custom form was deleted while you were editing it',
    );
  }

  return form;
};
