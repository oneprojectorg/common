import { invalidate } from '@op/cache';
import { createInstanceFromTemplate } from '@op/common';

import {
  createInstanceFromTemplateInputSchema,
  decisionProfileWithSchemaEncoder,
} from '../../../encoders/decision';
import { commonAuthedProcedure, router } from '../../../trpcFactory';

export const createInstanceFromTemplateRouter = router({
  createInstanceFromTemplate: commonAuthedProcedure()
    .input(createInstanceFromTemplateInputSchema)
    .output(decisionProfileWithSchemaEncoder)
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;

      const profile = await createInstanceFromTemplate({
        ...input,
        user,
      });

      // Creator was added as a profileUser with Admin role — invalidate the
      // user cache so the next getMyAccount reflects the new membership
      // before the client redirects to the edit page and re-checks access.
      await invalidate({
        type: 'user',
        params: [ctx.user.id],
      });

      return decisionProfileWithSchemaEncoder.parse(profile);
    }),
});
