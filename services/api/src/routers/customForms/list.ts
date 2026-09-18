import { Channels, listCustomForms } from '@op/common';
import { listCustomFormsInputSchema } from '@op/common/client';
import { z } from 'zod';

import { customFormWithPhaseEncoder } from '../../encoders';
import { authenticatedConfirmedProcedure, router } from '../../trpcFactory';

export const listCustomFormsRouter = router({
  // Every form definition on a decision process, for the admin editor.
  // Participants read a single form through `getForProfile` instead.
  // Authorization (platform admin or decision-process admin) is the service
  // layer's — this tier only rules out anonymous sessions.
  list: authenticatedConfirmedProcedure({
    rateLimit: { windowSize: 10, maxRequests: 60 },
  })
    .input(listCustomFormsInputSchema)
    .output(z.array(customFormWithPhaseEncoder))
    .query(async ({ input, ctx }) => {
      const forms = await listCustomForms({ data: input, user: ctx.user });

      ctx.registerQueryChannels([Channels.profileCustomForms(input.profileId)]);

      return forms.map((form) => customFormWithPhaseEncoder.parse(form));
    }),
});
