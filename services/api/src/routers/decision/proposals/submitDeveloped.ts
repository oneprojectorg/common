import { invalidate } from '@op/cache';
import { Channels, submitDevelopedProposal } from '@op/common';
import { proposalSchema } from '@op/common/client';
import { Events, inngest } from '@op/events';
import { waitUntil } from '@vercel/functions';

import { submitProposalInputSchema } from '../../../encoders/decision';
import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';
import { trackProposalSubmitted } from '../../../utils/analytics';

export const submitDevelopedProposalRouter = router({
  submitDevelopedProposal: networkAuthenticatedProcedure()
    .input(submitProposalInputSchema)
    .output(proposalSchema)
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;

      const { proposal, sourceProposalIds, processOwnerProfileId } =
        await submitDevelopedProposal({
          data: input,
          user,
        });
      const submittedAt = Date.now();

      waitUntil(
        invalidate({
          type: 'decision',
          params: [proposal.processInstanceId, 'submitters:v2'],
        }),
      );

      ctx.registerMutationChannels([
        Channels.decisionProposals(proposal.processInstanceId),
        Channels.decisionProposal(proposal.processInstanceId, proposal.id),
      ]);

      waitUntil(
        trackProposalSubmitted(ctx, proposal.processInstanceId, proposal.id, {
          created_timestamp: submittedAt,
          is_developed_entry: true,
          source_proposal_ids: sourceProposalIds,
          submitted_by_profile_id: proposal.submittedByProfileId,
          process_owner_profile_id: processOwnerProfileId,
          seconds_since_entry_created: proposal.createdAt
            ? Math.round((submittedAt - Date.parse(proposal.createdAt)) / 1000)
            : null,
        }),
      );

      waitUntil(
        inngest.send({
          name: Events.proposalSubmitted.name,
          data: { proposalId: proposal.id },
        }),
      );

      waitUntil(
        inngest.send({
          name: Events.contentSubmitted.name,
          data: {
            itemType: 'proposal',
            itemId: proposal.id,
          },
        }),
      );

      return proposalSchema.parse(proposal);
    }),
});
