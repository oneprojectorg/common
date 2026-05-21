import {
  getProcessSurveyResponse,
  submitProcessSurveyResponse,
} from '@op/common';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../trpcFactory';

const FREE_TEXT_MAX = 5000;
const OPTION_ID_MAX = 50;
const REASONS_MAX_ITEMS = 20;

const surveyInternalDataSchema = z
  .object({
    wasAdmin: z.boolean(),
    npsScore: z.number().int().min(0).max(10),
    completedAt: z.iso.datetime(),
    promoterReasons: z
      .array(z.string().max(OPTION_ID_MAX))
      .max(REASONS_MAX_ITEMS)
      .optional(),
    promoterReasonsOther: z.string().max(FREE_TEXT_MAX).optional(),
    detractorReasons: z
      .array(z.string().max(OPTION_ID_MAX))
      .max(REASONS_MAX_ITEMS)
      .optional(),
    detractorReasonsOther: z.string().max(FREE_TEXT_MAX).optional(),
    additionalFeedback: z.string().max(FREE_TEXT_MAX).optional(),
  })
  .strict();

export type SurveyInternalData = z.infer<typeof surveyInternalDataSchema>;

const submitProcessSurveyResponseInput = z.object({
  processInstanceId: z.uuid(),
  internalData: surveyInternalDataSchema,
  locale: z.string().max(10),
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
          locale: input.locale,
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
