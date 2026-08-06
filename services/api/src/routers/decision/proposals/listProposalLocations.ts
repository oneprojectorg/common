import {
  Channels,
  listAllProposalLocations,
  listProposalLocations,
} from '@op/common';
import {
  allProposalLocationsFilterSchema,
  proposalLocationsSchema,
} from '@op/common/client';

import { proposalLocationsFilterSchema } from '../../../encoders/decision';
import { openProcedure, router } from '../../../trpcFactory';

export const listProposalLocationsRouter = router({
  /**
   * Every located proposal visible in the phase being viewed — the browse
   * map's pin source, so the map isn't capped by the list's page size.
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
  /**
   * Every located proposal on the instance across all phases — the results
   * map's pin source, matching what `listAllProposals` pages through.
   */
  listAllProposalLocations: openProcedure({
    rateLimit: { windowSize: 10, maxRequests: 100 },
  })
    .input(allProposalLocationsFilterSchema)
    .output(proposalLocationsSchema)
    .query(async ({ ctx, input }) => {
      const { user } = ctx;
      const result = await listAllProposalLocations({
        input,
        user,
      });

      ctx.registerQueryChannels([
        Channels.decisionProposals(input.processInstanceId),
      ]);

      return proposalLocationsSchema.parse(result);
    }),
});
