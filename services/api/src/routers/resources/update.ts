import { updateResource } from '@op/common';
import { z } from 'zod';

import withDB from '../../middlewares/withDB';
import { commonAuthedProcedure, router } from '../../trpcFactory';
import { resourceWithSignedUrlEncoder } from './encoders';

const isHttpUrl = (raw: string): boolean => {
  try {
    const url = new URL(raw);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

const patchSchema = z
  .object({
    title: z.string().trim().min(1).max(50).optional(),
    description: z.string().max(250).nullable().optional(),
    linkUrl: z
      .string()
      .url()
      .max(2048)
      .refine(isHttpUrl, { message: 'Only http(s) URLs are allowed' })
      .optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: 'At least one field must be provided',
  });

export const update = router({
  update: commonAuthedProcedure({
    rateLimit: { windowSize: 10, maxRequests: 20 },
  })
    .use(withDB)
    .input(z.object({ id: z.string().uuid(), patch: patchSchema }))
    .output(resourceWithSignedUrlEncoder)
    .mutation(async ({ input, ctx }) => {
      const row = await updateResource({
        authUserId: ctx.user.id,
        id: input.id,
        patch: input.patch,
      });
      return resourceWithSignedUrlEncoder.parse(row);
    }),
});
