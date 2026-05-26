import { Channels, listAllProposals, listProposals } from '@op/common';
import {
  allProposalsFilterSchema,
  allProposalsListSchema,
  proposalListSchema,
} from '@op/common/client';

import { proposalFilterSchema } from '../../../encoders/decision';
import {
  commonAuthedProcedure,
  processInstanceProcedure,
  router,
} from '../../../trpcFactory';

export const listProposalsRouter = router({
  /** Lists proposals for a given process instanc in the curent phase. */
  listProposals: processInstanceProcedure({ requireUser: false })
    .input(proposalFilterSchema)
    .output(proposalListSchema)
    .query(async ({ ctx, input }) => {
      const { user, skipAccessCheck } = ctx;
      // The procedure resolves whether access checks should be skipped
      // (public-mode anonymous / no-JWT path). Handler just forwards the
      // decision to the service. See COLUMBUS_TECH_DEBT.md §2 for why
      // `skipAccessCheck` is the reused mechanism.
      const result = await listProposals({
        input: {
          ...input,
          authUserId: user?.id ?? '',
          skipAccessCheck,
        },
        user: (user ?? { id: '' }) as never,
      });

      ctx.registerQueryChannels([
        Channels.decisionProposals(input.processInstanceId),
      ]);

      return proposalListSchema.parse(result);
    }),
  /** Lists all proposals for a given process instance, no phase filter. */
  listAllProposals: commonAuthedProcedure()
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
});
