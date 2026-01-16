import { UnauthorizedError, listProposals } from '@op/common';
import { TRPCError } from '@trpc/server';

import { proposalListWithSchemaEncoder } from '../../../encoders/decision';
import { legacyProposalFilterSchema } from '../../../encoders/legacyDecision';
import { commonAuthedProcedure, router } from '../../../trpcFactory';

export const listProposalsRouter = router({
  listProposals: commonAuthedProcedure()
    .input(legacyProposalFilterSchema)
    .output(proposalListWithSchemaEncoder)
    .query(async ({ ctx, input }) => {
      const { user, logger } = ctx;

      try {
        const result = await listProposals({
          input: { ...input, authUserId: user.id },
          user,
        });

        return proposalListWithSchemaEncoder.parse(result);
      } catch (error: unknown) {
        logger.error('Failed to list proposals', {
          userId: user.id,
          filters: input,
          error,
        });

        if (error instanceof UnauthorizedError) {
          throw new TRPCError({
            message: error.message,
            code: 'UNAUTHORIZED',
          });
        }

        throw new TRPCError({
          message: 'Failed to list proposals',
          code: 'INTERNAL_SERVER_ERROR',
        });
      }
    }),
});
