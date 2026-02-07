import { type JSONContent, generateText } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { stringify } from 'csv-stringify/sync';

import { listProposals } from '../listProposals';
import { parseProposalData } from '../proposalDataSchema';

// Infer the proposal type from the listProposals return value
type ProposalFromList = Awaited<
  ReturnType<typeof listProposals>
>['proposals'][number];

const MAX_FALLBACK_TITLE_LENGTH = 140;
const tiptapTextExtensions = [StarterKit];

function extractTextFromTipTapContent(content: unknown): string {
  if (!Array.isArray(content)) {
    return '';
  }

  const doc: JSONContent = {
    type: 'doc',
    content: content as JSONContent[],
  };

  try {
    return generateText(doc, tiptapTextExtensions).trim();
  } catch {
    return '';
  }
}

function getDocumentText(proposal: ProposalFromList): string {
  const documentContent = proposal.documentContent;

  if (!documentContent) {
    return '';
  }

  if (documentContent.type === 'html') {
    return documentContent.content;
  }

  if (documentContent.type === 'json') {
    return extractTextFromTipTapContent(documentContent.content);
  }

  return '';
}

function getDocumentFallbackTitle(documentText: string): string {
  const firstLine = documentText
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  if (!firstLine) {
    return '';
  }

  return firstLine.slice(0, MAX_FALLBACK_TITLE_LENGTH);
}

export async function generateProposalsCsv(
  proposals: ProposalFromList[],
): Promise<string> {
  const rows = proposals.map((p) => {
    const proposalData = parseProposalData(p.proposalData);
    const documentText = getDocumentText(p);
    const title =
      proposalData.title?.trim() || getDocumentFallbackTitle(documentText);
    const description = proposalData.description?.trim() || documentText;

    return {
      'Proposal ID': p.id,
      Title: title,
      Description: description,
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
