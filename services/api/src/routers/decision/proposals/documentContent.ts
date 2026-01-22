import { createTipTapClient } from '@op/collab';
import { parseProposalData } from '@op/common';
import { logger } from '@op/logging';

import { type DocumentContent } from '../../../encoders/decision';

/**
 * Fetch document contents for proposals, handling both TipTap collaboration docs
 * and legacy HTML descriptions.
 *
 * - Proposals with `collaborationDocId`: fetched from TipTap in parallel
 * - Proposals with `description`: returned as HTML content (no network call)
 * - Proposals with neither: not included in the returned map
 *
 * @returns Map of proposalId -> DocumentContent
 */
export async function fetchDocumentContents(
  proposals: Array<{ id: string; proposalData: unknown }>,
): Promise<Map<string, DocumentContent>> {
  const documentContentMap = new Map<string, DocumentContent>();

  const proposalsWithCollabDoc: Array<{
    id: string;
    collaborationDocId: string;
  }> = [];

  for (const proposal of proposals) {
    const parsed = parseProposalData(proposal.proposalData);

    if (parsed.collaborationDocId) {
      proposalsWithCollabDoc.push({
        id: proposal.id,
        collaborationDocId: parsed.collaborationDocId,
      });
    } else if (parsed.description) {
      documentContentMap.set(proposal.id, {
        type: 'html',
        content: parsed.description,
      });
    }
  }

  // Fetch TipTap documents in parallel
  if (proposalsWithCollabDoc.length > 0) {
    const appId = process.env.NEXT_PUBLIC_TIPTAP_APP_ID;
    const secret = process.env.TIPTAP_SECRET;

    if (!appId || !secret) {
      logger.warn('TipTap credentials not configured, skipping document fetch');
      return documentContentMap;
    }

    const client = createTipTapClient({ appId, secret });

    const results = await Promise.all(
      proposalsWithCollabDoc.map(async ({ id, collaborationDocId }) => {
        try {
          const doc = await client.getDocument(collaborationDocId);
          return { id, doc };
        } catch (error) {
          logger.warn('Failed to fetch TipTap document', {
            collaborationDocId,
            error: error instanceof Error ? error.message : String(error),
          });
          return { id, doc: undefined };
        }
      }),
    );

    for (const { id, doc } of results) {
      if (doc?.content) {
        documentContentMap.set(id, { type: 'json', content: doc.content });
      }
    }
  }

  return documentContentMap;
}
