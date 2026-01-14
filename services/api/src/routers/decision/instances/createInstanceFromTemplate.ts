import { createInstanceFromTemplate } from '@op/common';
import type { OpenApiMeta } from 'trpc-to-openapi';

import {
  createInstanceFromTemplateInputSchema,
  decisionProfileEncoder,
} from '../../../encoders/decision';
import { commonAuthedProcedure, router } from '../../../trpcFactory';

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'POST',
    path: '/decision/instance',
    protect: true,
    tags: ['decision'],
    summary: 'Create process instance from a DecisionSchemaDefinition template',
  },
};

export const createInstanceFromTemplateRouter = router({
  createInstanceFromTemplate: commonAuthedProcedure()
    .meta(meta)
    .input(createInstanceFromTemplateInputSchema)
    .output(decisionProfileEncoder)
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;

      const profile = await createInstanceFromTemplate({
        ...input,
        user,
      });

      return decisionProfileEncoder.parse(profile);
    }),
});
