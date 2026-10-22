import { Channels, updateCustomForm } from '@op/common';
import { updateCustomFormInputSchema } from '@op/common/client';

import { customFormEncoder } from '../../encoders';
import { authenticatedConfirmedProcedure, router } from '../../trpcFactory';

export const updateCustomFormRouter = router({
  update: authenticatedConfirmedProcedure()
    .input(updateCustomFormInputSchema)
    .output(customFormEncoder)
    .mutation(async ({ input, ctx }) => {
      const form = await updateCustomForm({ data: input, user: ctx.user });

      ctx.registerMutationChannels([
        Channels.profileCustomForms(form.profileId),
      ]);

      return customFormEncoder.parse(form);
    }),
});
