import { type TipTapFragmentResponse, createTipTapClient } from '@op/collab';
import pMap from 'p-map';

import { getProposalFragmentNames } from './getProposalFragmentNames';
import { parseProposalData } from './proposalDataSchema';

/**
 * Proposal document content can be either TipTap JSON or legacy HTML
 */
export type ProposalDocumentContent =
  | { type: 'json'; fragments: TipTapFragmentResponse }
  | { type: 'html'; content: string };

/**
 * Fetch document contents for proposals, handling both TipTap collaboration docs
 * and legacy HTML descriptions.
 *
 * - Proposals with `collaborationDocId`: fetched from TipTap with controlled concurrency
 * - Proposals with `description`: returned as HTML content (no network call)
 * - Proposals with neither: not included in the returned map
 *
 * @returns Map of proposalId -> DocumentContent
 */
export async function getProposalDocumentsContent(
  proposals: Array<{
    id: string;
    proposalData: unknown;
    proposalTemplate?: Record<string, unknown> | null;
  }>,
): Promise<Map<string, ProposalDocumentContent>> {
  const documentContentMap = new Map<string, ProposalDocumentContent>();

  const proposalsWithCollabDoc: Array<{
    id: string;
    collaborationDocId: string;
    proposalTemplate?: Record<string, unknown> | null;
  }> = [];

  for (const proposal of proposals) {
    const parsed = parseProposalData(proposal.proposalData);

    if (parsed.collaborationDocId) {
      proposalsWithCollabDoc.push({
        id: proposal.id,
        collaborationDocId: parsed.collaborationDocId,
        proposalTemplate: proposal.proposalTemplate,
      });
    } else if (parsed.description) {
      documentContentMap.set(proposal.id, {
        type: 'html',
        content: parsed.description,
      });
    }
  }

  // Fetch TipTap documents with controlled concurrency
  if (proposalsWithCollabDoc.length > 0) {
    const appId = process.env.NEXT_PUBLIC_TIPTAP_APP_ID;
    const secret = process.env.TIPTAP_SECRET;

    if (!appId || !secret) {
      console.error(
        'TipTap credentials not configured, skipping document fetch',
      );
      return documentContentMap;
    }

    const client = createTipTapClient({ appId, secret });

    const results = await pMap(
      proposalsWithCollabDoc,
      async ({ id, collaborationDocId, proposalTemplate }) => {
        try {
          const fragmentNames = proposalTemplate
            ? getProposalFragmentNames(proposalTemplate)
            : ['default'];

          const fragments = await client.getDocumentFragments(
            collaborationDocId,
            fragmentNames,
          );

          return { id, fragments };
        } catch (error) {
          console.warn('Failed to fetch TipTap document', {
            collaborationDocId,
            error: error instanceof Error ? error.message : String(error),
          });
          return { id, fragments: undefined };
        }
      },
      { concurrency: 10 },
    );

    for (const { id, fragments } of results) {
      if (fragments) {
        documentContentMap.set(id, { type: 'json', fragments });
      }
    }
  }

  return documentContentMap;
}
