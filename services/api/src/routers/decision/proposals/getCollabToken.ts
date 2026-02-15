import { generateCollabToken } from '@op/collab/server';
import { getProfileAccessUser, parseProposalData } from '@op/common';
import { db } from '@op/db/client';
import { TRPCError } from '@trpc/server';
import { checkPermission, permission } from 'access-zones';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../../trpcFactory';

export const getCollabTokenRouter = router({
  getCollabToken: commonAuthedProcedure({
    rateLimit: { windowSize: 60, maxRequests: 30 },
  })
    .input(
      z.object({
        proposalProfileId: z.uuid(),
      }),
    )
    .output(z.object({ token: z.string() }))
    .query(async ({ ctx, input }) => {
      const { user } = ctx;
      const { proposalProfileId } = input;

      // Look up the proposal by its profile ID
      const proposal = await db._query.proposals.findFirst({
        where: { profileId: proposalProfileId },
        columns: {
          id: true,
          proposalData: true,
          profileId: true,
        },
      });

      if (!proposal) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Proposal not found',
        });
      }

      // Verify user has access to the proposal's profile
      const profileAccessUser = await getProfileAccessUser({
        user,
        profileId: proposalProfileId,
      });

      const hasAccess = checkPermission(
        { profile: permission.READ },
        profileAccessUser?.roles ?? [],
      );

      if (!hasAccess) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have access to this proposal',
        });
      }

      // Extract the collaboration doc ID from the proposal data
      const { collaborationDocId } = parseProposalData(proposal.proposalData);

      if (!collaborationDocId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Proposal does not have a collaboration document',
        });
      }

      const token = generateCollabToken(user.id, [collaborationDocId]);

      return { token };
    }),
});
