import { cache } from '@op/cache';
import { getPermissionsOnProposal, getProposal } from '@op/common';
import { logger } from '@op/logging';
import { waitUntil } from '@vercel/functions';
import { z } from 'zod';

import { proposalEncoder } from '../../../encoders/decision';
import { commonAuthedProcedure, router } from '../../../trpcFactory';
import { trackProposalViewed } from '../../../utils/analytics';
import { fetchDocumentContents } from './documentContent';

export const getProposalRouter = router({
  getProposal: commonAuthedProcedure()
    .input(
      z.object({
        profileId: z.uuid(),
      }),
    )
    .output(proposalEncoder)
    .query(async ({ ctx, input }) => {
      const { user } = ctx;
      const { profileId } = input;

      const proposal = await cache({
        type: 'profile',
        params: [profileId],
        fetch: () =>
          getProposal({
            profileId,
            user,
          }),
        options: {
          skipMemCache: true, // We need these to be editable and then immediately accessible
        },
      });

      // Fetch document content and permissions in parallel
      const [documentContentMap, isEditable] = await Promise.all([
        fetchDocumentContents([
          { id: proposal.id, proposalData: proposal.proposalData },
        ]),
        getPermissionsOnProposal({ user, proposal }).catch((error) => {
          logger.error('Error getting permissions on proposal', {
            error,
            profileId,
          });
          return false;
        }),
      ]);

      proposal.isEditable = isEditable;

      // Track proposal viewed event
      if (
        proposal.processInstance &&
        typeof proposal.processInstance === 'object' &&
        !Array.isArray(proposal.processInstance) &&
        'id' in proposal.processInstance
      ) {
        waitUntil(
          trackProposalViewed(ctx, proposal.processInstance.id, proposal.id),
        );
      }

      return proposalEncoder.parse({
        ...proposal,
        documentContent: documentContentMap.get(proposal.id),
      });
    }),
});
