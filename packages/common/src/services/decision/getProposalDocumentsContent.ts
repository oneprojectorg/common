import { type TipTapFragmentResponse, getTipTapClient } from '@op/collab';
import pMap from 'p-map';

import { getProposalFragmentNames } from './getProposalFragmentNames';
import { parseProposalData } from './proposalDataSchema';
import type { ProposalTemplateSchema } from './types';

/**
 * Proposal document content can be either TipTap JSON or legacy HTML.
 * Failed TipTap fetches throw — callers rely on Suspense to retry while
 * loading and ErrorBoundary to render a fallback when the fetch ultimately
 * fails.
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
    proposalTemplate?: ProposalTemplateSchema | null;
    collaborationDocVersionId?: number;
  }>,
): Promise<Map<string, ProposalDocumentContent>> {
  const documentContentMap = new Map<string, ProposalDocumentContent>();

  const proposalsWithCollabDoc: Array<{
    id: string;
    collaborationDocId: string;
    proposalTemplate?: ProposalTemplateSchema | null;
    collaborationDocVersionId?: number;
  }> = [];

  for (const proposal of proposals) {
    const parsed = parseProposalData(proposal.proposalData);

    if (parsed.collaborationDocId) {
      proposalsWithCollabDoc.push({
        id: proposal.id,
        collaborationDocId: parsed.collaborationDocId,
        proposalTemplate: proposal.proposalTemplate,
        collaborationDocVersionId: proposal.collaborationDocVersionId,
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
    const client = getTipTapClient();

    const results = await pMap(
      proposalsWithCollabDoc,
      async ({
        id,
        collaborationDocId,
        proposalTemplate,
        collaborationDocVersionId,
      }) => {
        const fragmentNames = proposalTemplate
          ? getProposalFragmentNames(proposalTemplate)
          : ['default'];

        const fragments = await client.getDocumentFragments(
          collaborationDocId,
          fragmentNames,
          collaborationDocVersionId != null
            ? { version: collaborationDocVersionId }
            : undefined,
        );

        return { id, fragments };
      },
      { concurrency: 10 },
    );

    for (const { id, fragments } of results) {
      documentContentMap.set(id, { type: 'json', fragments });
    }
  }

  return documentContentMap;
}
