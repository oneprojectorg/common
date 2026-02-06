import { stringify } from 'csv-stringify/sync';

import { listProposals } from '../listProposals';

// Infer the proposal type from the listProposals return value
type ProposalFromList = Awaited<
  ReturnType<typeof listProposals>
>['proposals'][number];

const MAX_FALLBACK_TITLE_LENGTH = 140;

function toText(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'number') {
    return String(value);
  }

  return '';
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function appendTipTapText(node: unknown, chunks: string[]): void {
  if (!node || typeof node !== 'object') {
    return;
  }

  const nodeData = node as {
    type?: unknown;
    text?: unknown;
    content?: unknown;
  };

  if (typeof nodeData.text === 'string') {
    chunks.push(nodeData.text);
  }

  if (Array.isArray(nodeData.content)) {
    for (const child of nodeData.content) {
      appendTipTapText(child, chunks);
    }
  }

  const type = typeof nodeData.type === 'string' ? nodeData.type : '';
  const isBlockNode =
    type === 'paragraph' ||
    type === 'heading' ||
    type === 'blockquote' ||
    type === 'listItem';

  if (type === 'hardBreak') {
    chunks.push('\n');
    return;
  }

  if (isBlockNode) {
    chunks.push('\n');
  }
}

function extractTextFromTipTapContent(content: unknown): string {
  if (!Array.isArray(content)) {
    return '';
  }

  const chunks: string[] = [];
  for (const node of content) {
    appendTipTapText(node, chunks);
  }

  return chunks
    .join('')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function getDocumentText(proposal: ProposalFromList): string {
  const documentContent = proposal.documentContent;

  if (!documentContent) {
    return '';
  }

  if (documentContent.type === 'html') {
    return stripHtml(documentContent.content);
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
    const proposalData =
      p.proposalData && typeof p.proposalData === 'object'
        ? (p.proposalData as Record<string, unknown>)
        : {};
    const documentText = getDocumentText(p);
    const title =
      toText(proposalData.title) || getDocumentFallbackTitle(documentText);
    const description =
      toText(proposalData.description) ||
      toText(proposalData.content) ||
      documentText;

    return {
      'Proposal ID': p.id,
      Title: title,
      Description: description,
      Budget: toText(proposalData.budget),
      Category: toText(proposalData.category),
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
