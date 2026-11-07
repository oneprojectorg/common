import { Channels, listFormSchemas } from '@op/common';
import { formSchemasListSchema } from '@op/common/client';
import { z } from 'zod';

import { authenticatedProcedure, router } from '../../../trpcFactory';

export const listFormSchemasRouter = router({
  /** Lists the form schema rows of an instance, oldest first. */
  listFormSchemas: authenticatedProcedure()
    .input(z.object({ processInstanceId: z.uuid() }))
    .output(formSchemasListSchema)
    .query(async ({ ctx, input }) => {
      const formSchemas = await listFormSchemas({
        processInstanceId: input.processInstanceId,
        user: ctx.user,
      });

      ctx.registerQueryChannels([
        Channels.decisionInstance(input.processInstanceId),
      ]);

      return formSchemasListSchema.parse({ items: formSchemas });
    }),
});
