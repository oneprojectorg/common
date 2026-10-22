import {
  Channels,
  listProposalRevisionNotes,
  proposalRevisionNoteListSchema,
} from '@op/common';
import { z } from 'zod';

import { authenticatedProcedure, router } from '../../../trpcFactory';

export const listProposalRevisionNotesRouter = router({
  listProposalRevisionNotes: authenticatedProcedure()
    .input(
      z.object({
        proposalId: z.uuid(),
      }),
    )
    .output(proposalRevisionNoteListSchema)
    .query(async ({ ctx, input }) => {
      const result = await listProposalRevisionNotes({
        proposalId: input.proposalId,
        user: ctx.user,
      });

      // A resubmission writes the request rows (`reviewAssignments`) and a new
      // proposal snapshot (`decisionProposal`) — both change what this read
      // returns.
      ctx.registerQueryChannels([
        Channels.reviewAssignments(result.processInstanceId),
        Channels.decisionProposal(result.processInstanceId, input.proposalId),
      ]);

      return proposalRevisionNoteListSchema.parse(result);
    }),
});
