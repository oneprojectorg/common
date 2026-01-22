import { listProposals } from '@op/common';

import { proposalListEncoder } from '../../../encoders/decision';
import { legacyProposalFilterSchema } from '../../../encoders/legacyDecision';
import { commonAuthedProcedure, router } from '../../../trpcFactory';
import { fetchDocumentContents } from './documentContent';

export const listProposalsRouter = router({
  listProposals: commonAuthedProcedure()
    .input(legacyProposalFilterSchema)
    .output(proposalListEncoder)
    .query(async ({ ctx, input }) => {
      const { user } = ctx;

      const result = await listProposals({
        input: { ...input, authUserId: user.id },
        user,
      });

      // Fetch document contents for all proposals in parallel
      const documentContentMap = await fetchDocumentContents(result.proposals);

      // Merge documentContent into each proposal
      const proposalsWithContent = result.proposals.map((proposal) => ({
        ...proposal,
        documentContent: documentContentMap.get(proposal.id),
      }));

      return proposalListEncoder.parse({
        ...result,
        proposals: proposalsWithContent,
      });
    }),
});
