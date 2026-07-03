import {
  createCustomFormSubmission,
  createCustomFormSubmissionInputSchema,
} from '@op/common';

import { customFormSubmissionEncoder } from '../../encoders';
import { authenticatedProcedure, router } from '../../trpcFactory';

export const submitCustomForm = router({
  submit: authenticatedProcedure()
    .input(createCustomFormSubmissionInputSchema)
    .output(customFormSubmissionEncoder)
    .mutation(async ({ input, ctx }) => {
      const submission = await createCustomFormSubmission({
        data: input,
        authUserId: ctx.user.id,
      });

      return customFormSubmissionEncoder.parse(submission);
    }),
});
