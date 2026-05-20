import {
  getProcessSurveyResponse,
  submitProcessSurveyResponse,
} from '@op/common';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../trpcFactory';

const submitProcessSurveyResponseInput = z.object({
  processInstanceId: z.uuid(),
  internalData: z.record(z.string(), z.unknown()),
});

const processSurveyQueryInput = z.object({
  processInstanceId: z.uuid(),
});

export const surveyRouter = router({
  submitProcessSurveyResponse: commonAuthedProcedure({
    rateLimit: { windowSize: 60, maxRequests: 10 },
  })
    .input(submitProcessSurveyResponseInput)
    .mutation(async ({ input, ctx }) => {
      return await submitProcessSurveyResponse({
        data: {
          processInstanceId: input.processInstanceId,
          internalData: input.internalData,
          authUserId: ctx.user.id,
        },
      });
    }),

  getProcessSurveyResponse: commonAuthedProcedure()
    .input(processSurveyQueryInput)
    .query(async ({ input, ctx }) => {
      return await getProcessSurveyResponse({
        data: {
          processInstanceId: input.processInstanceId,
          authUserId: ctx.user.id,
        },
      });
    }),
});
