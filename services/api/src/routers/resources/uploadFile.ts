import { signResourceUploadUrlForTarget } from '@op/common';
import { z } from 'zod';

import { commonNetworkProcedure, router } from '../../trpcFactory';

const inputSchema = z.object({
  target: z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('profile'),
      profileId: z.string().uuid(),
    }),
    z.object({
      kind: z.literal('collection'),
      collectionId: z.string().uuid(),
    }),
  ]),
  fileName: z.string().min(1).max(255),
});

const outputSchema = z.object({
  profileId: z.string().uuid(),
  storagePath: z.string(),
  signedUrl: z.string().url(),
  token: z.string(),
});

export const uploadFile = router({
  uploadFile: commonNetworkProcedure()
    .input(inputSchema)
    .output(outputSchema)
    .mutation(({ input, ctx }) =>
      signResourceUploadUrlForTarget({
        authUserId: ctx.user.id,
        target: input.target,
        fileName: input.fileName,
      }),
    ),
});
