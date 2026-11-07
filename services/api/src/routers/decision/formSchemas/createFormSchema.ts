import { Channels, createFormSchema } from '@op/common';
import {
  createFormSchemaInputSchema,
  formSchemaSchema,
} from '@op/common/client';

import { authenticatedProcedure, router } from '../../../trpcFactory';

export const createFormSchemaRouter = router({
  /** Stores a JSON Schema row for an instance. Instance admins only. */
  createFormSchema: authenticatedProcedure()
    .input(createFormSchemaInputSchema)
    .output(formSchemaSchema)
    .mutation(async ({ ctx, input }) => {
      const formSchema = await createFormSchema({
        processInstanceId: input.processInstanceId,
        name: input.name,
        schema: input.schema,
        parentId: input.parentId,
        user: ctx.user,
      });

      ctx.registerMutationChannels([
        Channels.decisionInstance(input.processInstanceId),
      ]);

      return formSchemaSchema.parse(formSchema);
    }),
});
