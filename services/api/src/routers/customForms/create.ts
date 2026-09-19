import { Channels, createCustomForm } from '@op/common';
import { createCustomFormInputSchema } from '@op/common/client';

import { customFormEncoder } from '../../encoders';
import { authenticatedConfirmedProcedure, router } from '../../trpcFactory';

export const createCustomFormRouter = router({
  create: authenticatedConfirmedProcedure()
    .input(createCustomFormInputSchema)
    .output(customFormEncoder)
    .mutation(async ({ input, ctx }) => {
      const form = await createCustomForm({ data: input, user: ctx.user });

      ctx.registerMutationChannels([
        Channels.profileCustomForms(form.profileId),
      ]);

      return customFormEncoder.parse(form);
    }),
});
