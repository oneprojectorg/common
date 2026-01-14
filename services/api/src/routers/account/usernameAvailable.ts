import { checkUsernameAvailability } from '@op/common';
import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../trpcFactory';

const endpoint = 'usernameAvailable';

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'GET',
    path: `/account/${endpoint}`,
    protect: true,
    tags: ['account'],
    summary: 'Check if username is available',
  },
};

const usernameAvailable = router({
  usernameAvailable: commonAuthedProcedure()
    .meta(meta)
    .input(
      z.object({
        username: z
          .string()
          .max(255)
          .regex(/^$|^[a-z0-9_]+$/),
      }),
    )
    .output(
      z.object({
        available: z.boolean(),
      }),
    )
    .query(async ({ input }) => {
      const { username } = input;
      return await checkUsernameAvailability({ username });
    }),
});

export default usernameAvailable;
