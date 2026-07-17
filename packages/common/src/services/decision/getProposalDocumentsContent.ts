import {
  type TipTapFragmentResponse,
  getCachedDocumentFragments,
  getTipTapClient,
} from '@op/collab';
import { logger } from '@op/logging';
import pMap from 'p-map';

import { getProposalFragmentNames } from './getProposalFragmentNames';
import { parseProposalData } from './proposalDataSchema';
import type { ProposalTemplateSchema } from './types';

/**
 * Proposal document content can be either TipTap JSON or legacy HTML, or a
 * sentinel marking the document as temporarily unavailable.
 *
 * A failed TipTap fetch can mean two different things that look identical at
 * the moment of the request (both surface as a 404): the document is still
 * propagating from the collaboration server (transient — it will appear), or
 * it is genuinely gone (permanent). The caller picks how to handle that via
 * `onFetchError`:
 * - `'omit'` (default): the failing proposal is left out of the returned map
 *   (its `documentContent` is undefined). Used by list reads so a single
 *   unavailable document can't break the entire list.
 * - `'unavailable'`: the proposal is mapped to `{ type: 'unavailable' }`.
 *   Used by the single-proposal viewer so the rest of the proposal still
 *   renders while the client polls for the document, and only shows a
 *   "content not found" state once a bounded wait elapses — instead of
 *   flashing an error the instant a still-syncing document 404s.
 */
export type ProposalDocumentContent =
  | { type: 'json'; fragments: TipTapFragmentResponse }
  | { type: 'html'; content: string }
  | { type: 'unavailable' };

export interface GetProposalDocumentsContentOptions {
  /**
   * What to do when a TipTap document fetch fails.
   * Defaults to `'omit'`.
   */
  onFetchError?: 'omit' | 'unavailable';
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
  const { onFetchError = 'omit' } = options;
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
          const fragments = await getCachedDocumentFragments({
            client,
            docId: collaborationDocId,
            versionId: collaborationDocVersionId,
            fragmentNames,
          });

          return { id, fragments, failed: false as const };
        } catch (error) {
          logger.error('Failed to fetch TipTap document', {
            collaborationDocId,
            error,
          });
          return { id, fragments: undefined, failed: true as const };
        }
      },
      { concurrency: 10 },
    );

    for (const { id, fragments, failed } of results) {
      if (fragments) {
        documentContentMap.set(id, { type: 'json', fragments });
      } else if (failed && onFetchError === 'unavailable') {
        // Distinguish "couldn't fetch" from "no document": list reads omit
        // the entry, but the viewer needs the sentinel to drive its poll +
        // bounded "content not found" fallback.
        documentContentMap.set(id, { type: 'unavailable' });
      }
    }
  }

  return documentContentMap;
}
