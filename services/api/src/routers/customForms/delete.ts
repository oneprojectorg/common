import { Channels, deleteCustomForm } from '@op/common';
import { deleteCustomFormInputSchema } from '@op/common/client';
import { z } from 'zod';

import { authenticatedConfirmedProcedure, router } from '../../trpcFactory';

export const deleteCustomFormRouter = router({
  delete: authenticatedConfirmedProcedure()
    .input(deleteCustomFormInputSchema)
    .output(z.object({ success: z.literal(true) }))
    .mutation(async ({ input, ctx }) => {
      const { profileId } = await deleteCustomForm({
        data: input,
        user: ctx.user,
      });

      ctx.registerMutationChannels([Channels.profileCustomForms(profileId)]);

      return { success: true } as const;
    }),
});
