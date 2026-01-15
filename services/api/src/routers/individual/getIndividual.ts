import {
  UnauthorizedError,
  getIndividualTerms,
  getIndividualTermsByProfile,
} from '@op/common';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { individualsTermsEncoder } from '../../encoders/individuals';
import { commonAuthedProcedure, router } from '../../trpcFactory';

export const getIndividualRouter = router({
  getTerms: commonAuthedProcedure()
    .input(z.object({ id: z.string(), termUri: z.string().optional() }))
    .output(individualsTermsEncoder)
    .query(async ({ input }) => {
      const { id } = input;

      try {
        const result = await getIndividualTerms({
          individualId: id,
        });

        if (!result) {
          throw new TRPCError({
            message: 'Individual terms not found',
            code: 'NOT_FOUND',
          });
        }

        return individualsTermsEncoder.parse(result);
      } catch (error: unknown) {
        console.log(error);
        if (error instanceof UnauthorizedError) {
          throw new TRPCError({
            message: 'You do not have access to this individual',
            code: 'UNAUTHORIZED',
          });
        }

        throw new TRPCError({
          message: 'Individual terms not found',
          code: 'NOT_FOUND',
        });
      }
    }),
  getTermsByProfile: commonAuthedProcedure()
    .input(z.object({ profileId: z.string(), termUri: z.string().optional() }))
    .output(individualsTermsEncoder)
    .query(async ({ input }) => {
      const { profileId } = input;

      try {
        const result = await getIndividualTermsByProfile({
          profileId,
        });

        return individualsTermsEncoder.parse(result);
      } catch (error: unknown) {
        console.log(error);
        if (error instanceof UnauthorizedError) {
          throw new TRPCError({
            message: 'You do not have access to this profile',
            code: 'UNAUTHORIZED',
          });
        }

        throw new TRPCError({
          message: 'Individual terms not found',
          code: 'NOT_FOUND',
        });
      }
    }),
});
