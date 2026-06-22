import { type TipTapFragmentResponse, getTipTapClient } from '@op/collab';
import pMap from 'p-map';

import { getProposalFragmentNames } from './getProposalFragmentNames';
import { parseProposalData } from './proposalDataSchema';
import type { ProposalTemplateSchema } from './types';

/**
 * Proposal document content can be either TipTap JSON or legacy HTML.
 *
 * How a failed TipTap fetch is handled depends on `onFetchError`:
 * - `'throw'` (default): the error propagates. Used by single-proposal reads
 *   (e.g. the proposal viewer) so the client can rely on Suspense to retry
 *   while loading and an ErrorBoundary to render a fallback when the fetch
 *   ultimately fails — instead of flashing an inline error.
 * - `'omit'`: the failing proposal is left out of the returned map (its
 *   `documentContent` is undefined). Used by list reads so a single
 *   unavailable document can't break the entire list.
 */
export type ProposalDocumentContent =
  | { type: 'json'; fragments: TipTapFragmentResponse }
  | { type: 'html'; content: string };

export interface GetProposalDocumentsContentOptions {
  /**
   * What to do when a TipTap document fetch fails.
   * Defaults to `'throw'`.
   */
  onFetchError?: 'throw' | 'omit';
}

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
  options: GetProposalDocumentsContentOptions = {},
): Promise<Map<string, ProposalDocumentContent>> {
  const { onFetchError = 'throw' } = options;
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

        try {
          const fragments = await client.getDocumentFragments(
            collaborationDocId,
            fragmentNames,
            collaborationDocVersionId != null
              ? { version: collaborationDocVersionId }
              : undefined,
          );

          return { id, fragments };
        } catch (error) {
          if (onFetchError === 'throw') {
            throw error;
          }

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
