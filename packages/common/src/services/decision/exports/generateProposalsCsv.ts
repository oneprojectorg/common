import { type JSONContent, generateText } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { stringify } from 'csv-stringify/sync';

import type { listProposals } from '../listProposals';
import {
  formatProposalCategories,
  parseProposalData,
} from '../proposalDataSchema';

// Infer the proposal type from the listProposals return value
type ProposalFromList = Awaited<
  ReturnType<typeof listProposals>
>['proposals'][number];

/**
 * Extract plain text description from a proposal's document content.
 * Uses TipTap generateText for collab docs, falls back to proposalData.description for legacy.
 */
function getDocumentDescription(proposal: ProposalFromList): string {
  const documentContent = proposal.documentContent;

  if (documentContent?.type === 'json') {
    try {
      const content = documentContent.fragments.default?.content;
      if (!content) return '';
      const doc: JSONContent = {
        type: 'doc',
        content: content as JSONContent[],
      };
      return generateText(doc, [StarterKit]).trim();
    } catch {
      return '';
    }
  }

  const proposalData = parseProposalData(proposal.proposalData);
  return proposalData.description?.trim() || '';
}

export async function generateProposalsCsv(
  proposals: ProposalFromList[],
): Promise<string> {
  const rows = proposals.map((p) => {
    const proposalData = parseProposalData(p.proposalData);

    return {
      'Proposal ID': p.id,
      Title: p.profile?.name || '',
      Description: getDocumentDescription(p),
      Budget: proposalData.budget?.amount ?? '',
      // The row's own resolved currency, not a second resolve here: a budget
      // that named none is denominated in the process's, and a spreadsheet of
      // bare amounts with an empty Currency column can't be reconstructed at
      // all. `listProposals` already applied the full precedence — including
      // the fragment tier, which this row's `proposalData` alone can't see —
      // so re-deriving it would export a currency the UI doesn't show.
      Currency: proposalData.budget ? p.budgetCurrency : '',
      Categories: formatProposalCategories(proposalData.category),
      Status: p.status,
      'Submitted By': p.submittedBy?.name || '',
      'Submitter Email': p.submittedBy?.email || '',
      'Profile ID': p.profileId,
      Likes: p.likesCount || 0,
      Comments: p.commentsCount || 0,
      Followers: p.followersCount || 0,
      'Created At': p.createdAt ? new Date(p.createdAt).toISOString() : '',
      'Updated At': p.updatedAt ? new Date(p.updatedAt).toISOString() : '',
    };
  });

  return stringify(rows, {
    header: true,
    quoted: true,
  });
}
