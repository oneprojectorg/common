import { checkUsernameAvailability } from '@op/common';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../trpcFactory';

const usernameAvailable = router({
  usernameAvailable: commonAuthedProcedure()
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
