import {
  Channels,
  listAllProposals,
  listProposalLocations,
  listProposals,
} from '@op/common';
import {
  allProposalsFilterSchema,
  allProposalsListSchema,
  proposalListSchema,
  proposalLocationsSchema,
} from '@op/common/client';

import {
  proposalFilterSchema,
  proposalLocationsFilterSchema,
} from '../../../encoders/decision';
import { openProcedure, router } from '../../../trpcFactory';

export const listProposalsRouter = router({
  /** Lists proposals for a given process instance in the current phase. */
  listProposals: openProcedure()
    .input(proposalFilterSchema)
    .output(proposalListSchema)
    .query(async ({ ctx, input }) => {
      const { user } = ctx;
      const result = await listProposals({
        input,
        user,
      });

      ctx.registerQueryChannels([
        Channels.decisionProposals(input.processInstanceId),
      ]);

      return proposalListSchema.parse(result);
    }),
  /** Lists all proposals for a given process instance, no phase filter. */
  listAllProposals: openProcedure()
    .input(allProposalsFilterSchema)
    .output(allProposalsListSchema)
    .query(async ({ ctx, input }) => {
      const { user } = ctx;
      const result = await listAllProposals({
        input,
        user,
      });

      ctx.registerQueryChannels([
        Channels.decisionProposals(input.processInstanceId),
      ]);

      return allProposalsListSchema.parse(result);
    }),
  /**
   * Every located proposal in the instance's current scope — the map's pin
   * source, so the map isn't capped by the list's page size.
   */
  listProposalLocations: openProcedure()
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
