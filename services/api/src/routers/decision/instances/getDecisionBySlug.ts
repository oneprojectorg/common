import {
  Channels,
  fromDecisionBitField,
  getDecisionBySlug,
  getProfileAccessRoles,
} from '@op/common';
import { collapseRoles } from 'access-zones';
import { z } from 'zod';

import { decisionProfileWithSchemaEncoder } from '../../../encoders/decision';
import { openProcedure, router } from '../../../trpcFactory';

const inputSchema = z.object({
  slug: z.string().min(1, 'Slug cannot be empty'),
});

export const getDecisionBySlugRouter = router({
  getDecisionBySlug: openProcedure({
    rateLimit: { windowSize: 10, maxRequests: 100 },
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

      const roles = await getProfileAccessRoles({
        user,
        profileId,
      });

      const decisionsBitField = collapseRoles(roles)['decisions'] ?? 0;

      ctx.registerQueryChannels([
        Channels.decisionInstance(parsed.processInstance.id),
      ]);

      return decisionProfileWithSchemaEncoder.parse({
        ...parsed,
        processInstance: {
          ...parsed.processInstance,
          access: fromDecisionBitField(decisionsBitField),
        },
      });
    }),
});
