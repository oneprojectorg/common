import { getFormSchema } from '@op/common';
import { formSchemaRefSchema, formSchemaSchema } from '@op/common/client';

import { authenticatedProcedure, router } from '../../../trpcFactory';

export const getFormSchemaRouter = router({
  /** Returns one form schema row. Rows are immutable, so no channel is needed. */
  getFormSchema: authenticatedProcedure()
    .input(formSchemaRefSchema)
    .output(formSchemaSchema)
    .query(async ({ ctx, input }) => {
      const formSchema = await getFormSchema({
        formSchemaId: input.formSchemaId,
        user: ctx.user,
      });

      return formSchemaSchema.parse(formSchema);
    }),
});
