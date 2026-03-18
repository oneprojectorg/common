import {
  CommonError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
  listProposalVersions,
} from '@op/common';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { proposalVersionListEncoder } from '../../../encoders/decision';
import { commonAuthedProcedure, router } from '../../../trpcFactory';

export const listProposalVersionsRouter = router({
  listProposalVersions: commonAuthedProcedure()
    .input(
      z.object({
        proposalId: z.uuid(),
      }),
    )
    .output(proposalVersionListEncoder)
    .query(async ({ ctx, input }) => {
      const { logger, user } = ctx;

      try {
        const result = await listProposalVersions({
          proposalId: input.proposalId,
          user,
        });

        return proposalVersionListEncoder.parse(result);
      } catch (error: unknown) {
        logger.error('Failed to list proposal versions', {
          error,
          proposalId: input.proposalId,
          userId: user.id,
        });

        if (error instanceof UnauthorizedError) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: error.message,
          });
        }

        if (error instanceof NotFoundError) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: error.message,
          });
        }

        if (error instanceof ValidationError) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message,
          });
        }

        if (error instanceof CommonError) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error.message,
          });
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to list proposal versions',
        });
      }
    }),
});
