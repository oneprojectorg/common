import {
  CommonError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
  getProposalVersion,
} from '@op/common';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { proposalVersionPreviewEncoder } from '../../../encoders/decision';
import { commonAuthedProcedure, router } from '../../../trpcFactory';

export const getProposalVersionRouter = router({
  getProposalVersion: commonAuthedProcedure()
    .input(
      z.object({
        proposalId: z.uuid(),
        versionId: z.number().int().min(0),
      }),
    )
    .output(proposalVersionPreviewEncoder)
    .query(async ({ ctx, input }) => {
      const { logger, user } = ctx;

      try {
        const result = await getProposalVersion({
          proposalId: input.proposalId,
          user,
          versionId: input.versionId,
        });

        return proposalVersionPreviewEncoder.parse(result);
      } catch (error: unknown) {
        logger.error('Failed to load proposal version preview', {
          error,
          proposalId: input.proposalId,
          userId: user.id,
          versionId: input.versionId,
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
          message: 'Failed to load proposal version preview',
        });
      }
    }),
});
