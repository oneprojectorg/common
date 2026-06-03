import { listDecisionProfiles } from '@op/common';

import {
  decisionProfileWithSchemaFilterSchema,
  decisionProfileWithSchemaListEncoder,
} from '../../../encoders/decision';
import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

export const listDecisionProfilesRouter = router({
  listDecisionProfiles: networkAuthenticatedProcedure()
    .input(decisionProfileWithSchemaFilterSchema)
    .output(decisionProfileWithSchemaListEncoder)
    .query(async ({ input, ctx }) => {
      const { user } = ctx;

      const result = await listDecisionProfiles({
        ...input,
        user,
      });

      return decisionProfileWithSchemaListEncoder.parse(result);
    }),
});
