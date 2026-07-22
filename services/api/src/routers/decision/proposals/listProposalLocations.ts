import { Channels, listProposalLocations } from '@op/common';
import { proposalLocationsSchema } from '@op/common/client';

import { proposalLocationsFilterSchema } from '../../../encoders/decision';
import { openProcedure, router } from '../../../trpcFactory';

export const listProposalLocationsRouter = router({
  /**
   * Every located proposal in the instance's current scope — the map's pin
   * source, so the map isn't capped by the list's page size.
   */
  listProposalLocations: openProcedure({
    rateLimit: { windowSize: 10, maxRequests: 100 },
  })
    .input(proposalLocationsFilterSchema)
    .output(proposalLocationsSchema)
    .query(async ({ ctx, input }) => {
      const { user } = ctx;
      const result = await listProposalLocations({
        input,
        user,
      });

      ctx.registerQueryChannels([
        Channels.decisionProposals(input.processInstanceId),
      ]);

      return proposalLocationsSchema.parse(result);
    }),
});
