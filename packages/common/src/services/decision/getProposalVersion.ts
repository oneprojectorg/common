import type { User } from '@op/supabase/lib';

import { CommonError, NotFoundError } from '../../utils';
import {
  buildVersionProposalData,
  extractTextFragments,
  getProposalVersionContext,
  normalizeVersionSnapshot,
  sortVersionsDesc,
} from './proposalVersionUtils';

/**
 * Loads a saved TipTap version preview for a proposal collaboration document.
 */
export async function getProposalVersion({
  proposalId,
  user,
  versionId,
}: {
  proposalId: string;
  user: User;
  versionId: number;
}) {
  const { client, collaborationDocId, proposalTemplate } =
    await getProposalVersionContext({
      proposalId,
      user,
    });

  try {
    const versions = sortVersionsDesc(
      await client.listVersions(collaborationDocId),
    );
    const version = versions.find((entry) => entry.version === versionId);

    if (!version) {
      throw new NotFoundError('Proposal version');
    }

    const snapshot = await client.getVersion(collaborationDocId, versionId);
    const fragments = normalizeVersionSnapshot(snapshot);

    if (!fragments) {
      throw new CommonError('Unsupported TipTap version payload');
    }

    return {
      version,
      proposalData: buildVersionProposalData({
        collaborationDocId,
        fragmentTexts: extractTextFragments(fragments),
        proposalTemplate,
      }),
      documentContent: {
        type: 'json' as const,
        fragments,
      },
    };
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }

    if (error instanceof Error && error.message.includes('404')) {
      throw new NotFoundError('Proposal version');
    }

    throw new CommonError('Failed to load proposal version');
  }
}
