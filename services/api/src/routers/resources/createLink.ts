import { createLinkResource } from '@op/common';
import { z } from 'zod';

import withDB from '../../middlewares/withDB';
import { commonAuthedProcedure, router } from '../../trpcFactory';
import { resourceInCollectionEncoder } from './encoders';

const isHttpUrl = (raw: string): boolean => {
  try {
    const url = new URL(raw);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

const inputSchema = z
  .object({
    profileId: z.string().uuid().optional(),
    collectionId: z.string().uuid().optional(),
    title: z.string().trim().min(1).max(50),
    description: z.string().max(250).nullable().optional(),
    linkUrl: z
      .string()
      .url()
      .max(2048)
      .refine(isHttpUrl, { message: 'Only http(s) URLs are allowed' }),
  })
  .refine(
    (v) => (v.profileId === undefined) !== (v.collectionId === undefined),
    { message: 'Exactly one of profileId / collectionId is required' },
  );

export const createLink = router({
  createLink: commonAuthedProcedure({
    rateLimit: { windowSize: 10, maxRequests: 10 },
  })
    .use(withDB)
    .input(inputSchema)
    .output(resourceInCollectionEncoder)
    .mutation(async ({ input, ctx }) => {
      const row = await createLinkResource({
        authUserId: ctx.user.id,
        profileId: input.profileId,
        collectionId: input.collectionId,
        title: input.title,
        description: input.description ?? null,
        linkUrl: input.linkUrl,
      });
      return resourceInCollectionEncoder.parse(row);
    }),
});
