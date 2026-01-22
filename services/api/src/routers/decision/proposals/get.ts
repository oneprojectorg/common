import { cache } from '@op/cache';
import { type TipTapDocument, createTipTapClient } from '@op/collab';
import {
  type ProposalData,
  getPermissionsOnProposal,
  getProposal,
  parseProposalData,
} from '@op/common';
import { logger } from '@op/logging';
import { waitUntil } from '@vercel/functions';
import { z } from 'zod';

import {
  type DocumentContent,
  proposalEncoder,
} from '../../../encoders/decision';
import { commonAuthedProcedure, router } from '../../../trpcFactory';
import { trackProposalViewed } from '../../../utils/analytics';

/**
 * Fetch TipTap document content for a proposal.
 * Returns undefined on any error (404, timeout, config missing, etc.).
 */
async function fetchTipTapDocument(
  collaborationDocId: string,
): Promise<TipTapDocument | undefined> {
  const appId = process.env.NEXT_PUBLIC_TIPTAP_APP_ID;
  const secret = process.env.TIPTAP_SECRET;

  if (!appId || !secret) {
    logger.warn('TipTap credentials not configured, skipping document fetch');
    return undefined;
  }

  try {
    const client = createTipTapClient({ appId, secret });
    return await client.getDocument(collaborationDocId);
  } catch (error) {
    logger.warn('Failed to fetch TipTap document', {
      collaborationDocId,
      error: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
}

/**
 * Build documentContent based on proposal data.
 * - If collaborationDocId exists: fetch from TipTap, return json type (or undefined on failure)
 * - If no collaborationDocId but description exists: return html type
 * - Otherwise: undefined
 */
async function buildDocumentContent(
  proposalData: ProposalData,
): Promise<DocumentContent | undefined> {
  const { collaborationDocId, description } = proposalData;

  // New proposals with TipTap collaboration
  if (collaborationDocId) {
    const tiptapDoc = await fetchTipTapDocument(collaborationDocId);
    if (tiptapDoc?.content) {
      return { type: 'json', content: tiptapDoc.content };
    }
    // TipTap fetch failed - return undefined, let UI handle error state
    return undefined;
  }

  // Legacy proposals with HTML/text description
  if (description) {
    return { type: 'html', content: description };
  }

  return undefined;
}

export const getProposalRouter = router({
  getProposal: commonAuthedProcedure()
    .input(
      z.object({
        profileId: z.uuid(),
      }),
    )
    .output(proposalEncoder)
    .query(async ({ ctx, input }) => {
      const { user } = ctx;
      const { profileId } = input;

      const proposal = await cache({
        type: 'profile',
        params: [profileId],
        fetch: () =>
          getProposal({
            profileId,
            user,
          }),
        options: {
          skipMemCache: true, // We need these to be editable and then immediately accessible
        },
      });

      const proposalData = parseProposalData(proposal.proposalData);

      // Fetch document content and permissions in parallel
      const [documentContent, isEditable] = await Promise.all([
        buildDocumentContent(proposalData),
        getPermissionsOnProposal({ user, proposal }).catch((error) => {
          logger.error('Error getting permissions on proposal', {
            error,
            profileId,
          });
          return false;
        }),
      ]);

      proposal.isEditable = isEditable;

      // Track proposal viewed event
      if (
        proposal.processInstance &&
        typeof proposal.processInstance === 'object' &&
        !Array.isArray(proposal.processInstance) &&
        'id' in proposal.processInstance
      ) {
        waitUntil(
          trackProposalViewed(ctx, proposal.processInstance.id, proposal.id),
        );
      }

      return proposalEncoder.parse({
        ...proposal,
        documentContent,
      });
    }),
});
