import { Channels, listCustomForms } from '@op/common';
import { listCustomFormsInputSchema } from '@op/common/client';
import { z } from 'zod';

import { customFormWithPhaseEncoder } from '../../encoders';
import { authenticatedConfirmedProcedure, router } from '../../trpcFactory';

export const listCustomFormsRouter = router({
  // This tier only rules out anonymous sessions; the service layer authorizes.
  list: authenticatedConfirmedProcedure()
    .input(listCustomFormsInputSchema)
    .output(z.array(customFormWithPhaseEncoder))
    .query(async ({ input, ctx }) => {
      const forms = await listCustomForms({ data: input, user: ctx.user });

      ctx.registerQueryChannels([Channels.profileCustomForms(input.profileId)]);

      return forms.map((form) => customFormWithPhaseEncoder.parse(form));
    }),
});
