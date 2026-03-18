import { type TipTapVersion, getTipTapClient } from '@op/collab';
import type { User } from '@op/supabase/lib';

import { CommonError } from '../../utils';
import { assertProposalVersionPermissions } from './proposalVersionUtils';

/**
 * Lists the saved TipTap versions for a proposal collaboration document.
 */
export async function listProposalVersions({
  proposalId,
  user,
}: {
  proposalId: string;
  user: User;
}): Promise<{ versions: TipTapVersion[] }> {
  const { collaborationDocId } = await assertProposalVersionPermissions({
    proposalId,
    user,
  });
  const client = getTipTapClient();

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

function sortVersionsDesc(versions: TipTapVersion[]): TipTapVersion[] {
  return [...versions].sort((left, right) => {
    return right.version - left.version;
  });
}
