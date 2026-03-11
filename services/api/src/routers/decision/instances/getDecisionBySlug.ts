import {
  fromDecisionBitField,
  getDecisionBySlug,
  getProfileAccessUser,
} from '@op/common';
import { collapseRoles } from 'access-zones';
import { z } from 'zod';

import { decisionProfileWithSchemaEncoder } from '../../../encoders/decision';
import { commonAuthedProcedure, router } from '../../../trpcFactory';

const inputSchema = z.object({
  slug: z.string().min(1, 'Slug cannot be empty'),
});

export const getDecisionBySlugRouter = router({
  getDecisionBySlug: commonAuthedProcedure({
    rateLimit: { windowSize: 10, maxRequests: 20 },
  })
    .input(inputSchema)
    .output(decisionProfileWithSchemaEncoder)
    .query(async ({ input, ctx }) => {
      const { user } = ctx;
      const { slug } = input;

      const result = await getDecisionBySlug({
        slug,
        user,
      });

      const parsed = decisionProfileWithSchemaEncoder.parse(result);

      const { profileId } = parsed.processInstance;
      if (!profileId) {
        throw new Error('Decision profile ID is missing');
      }

      const profileUser = await getProfileAccessUser({
        user,
        profileId,
      });

      const decisionsBitField =
        collapseRoles(profileUser?.roles ?? [])['decisions'] ?? 0;

      return decisionProfileWithSchemaEncoder.parse({
        ...parsed,
        processInstance: {
          ...parsed.processInstance,
          access: fromDecisionBitField(decisionsBitField),
        },
      });
    }),
});
