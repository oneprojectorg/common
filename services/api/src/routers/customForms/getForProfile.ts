import { getCustomFormForProfile } from '@op/common';
import { z } from 'zod';

import { customFormEncoder } from '../../encoders';
import { openProcedure, router } from '../../trpcFactory';

const inputSchema = z.object({
  profileId: z.uuid(),
});

export const getForProfile = router({
  getForProfile: openProcedure({
    rateLimit: { windowSize: 10, maxRequests: 30 },
  })
    .input(inputSchema)
    .output(customFormEncoder.nullable())
    .query(async ({ input }) => {
      const form = await getCustomFormForProfile({
        profileId: input.profileId,
      });

      return form ? customFormEncoder.parse(form) : null;
    }),
});
