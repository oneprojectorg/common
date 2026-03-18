import type { User } from '@op/supabase/lib';

import { CommonError } from '../../utils';
import {
  getProposalVersionContext,
  sortVersionsDesc,
} from './proposalVersionUtils';

/**
 * Lists the saved TipTap versions for a proposal collaboration document.
 */
export async function listProposalVersions({
  proposalId,
  user,
}: {
  proposalId: string;
  user: User;
}) {
  const { client, collaborationDocId } = await getProposalVersionContext({
    proposalId,
    user,
  });

  try {
    const versions = await client.listVersions(collaborationDocId);

    return {
      versions: sortVersionsDesc(versions),
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes('404')) {
      return {
        versions: [],
      };
    }

    throw new CommonError('Failed to load proposal version history');
  }
}
