import { listDecisionProfiles } from '@op/common';

import {
  decisionProfileWithSchemaFilterSchema,
  decisionProfileWithSchemaListEncoder,
} from '../../../encoders/decision';
import { commonNetworkProcedure, router } from '../../../trpcFactory';

export const listDecisionProfilesRouter = router({
  listDecisionProfiles: commonNetworkProcedure()
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
