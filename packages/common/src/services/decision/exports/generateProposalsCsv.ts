import { type JSONContent, generateText } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { stringify } from 'csv-stringify/sync';

import type { listProposals } from '../listProposals';
import { parseProposalData } from '../proposalDataSchema';

// Infer the proposal type from the listProposals return value
type ProposalFromList = Awaited<
  ReturnType<typeof listProposals>
>['proposals'][number];

/**
 * Extract plain text description from a proposal's documentContent.
 * Uses TipTap's generateText for JSON docs, returns HTML string as-is for legacy.
 */
function getDocumentDescription(proposal: ProposalFromList): string {
  const documentContent = proposal.documentContent;

  if (!documentContent) {
    return '';
  }

  if (documentContent.type === 'html') {
    return documentContent.content;
  }

  if (documentContent.type === 'json') {
    try {
      const doc: JSONContent = {
        type: 'doc',
        content: documentContent.content as JSONContent[],
      };
      return generateText(doc, [StarterKit]).trim();
    } catch {
      return '';
    }
  }

  return '';
}

export async function generateProposalsCsv(
  proposals: ProposalFromList[],
): Promise<string> {
  const rows = proposals.map((p) => {
    const proposalData = parseProposalData(p.proposalData);

    return {
      'Proposal ID': p.id,
      Title: proposalData.title || '',
      Description:
        proposalData.description?.trim() || getDocumentDescription(p),
      Budget: proposalData.budget ?? '',
      Category: proposalData.category ?? '',
      Status: p.status,
      'Submitted By': p.submittedBy?.name || '',
      'Submitter Email': p.submittedBy?.email || '',
      'Profile ID': p.profileId,
      Votes: p.decisionCount || 0,
      Likes: p.likesCount || 0,
      Comments: p.commentsCount || 0,
      Followers: p.followersCount || 0,
      'Created At': new Date(p.createdAt).toISOString(),
      'Updated At': new Date(p.updatedAt).toISOString(),
    };
  });

  return stringify(rows, {
    header: true,
    quoted: true,
  });
}
