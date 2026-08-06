import { type TipTapVersion, getTipTapClient } from '@op/collab';
import { logger } from '@op/logging';

import { CommonError } from '../../utils';

/**
 * Mints a named TipTap version for a proposal's collaboration document and
 * returns its version number.
 *
 * The returned number is stamped into `proposalData.collaborationDocVersionId`,
 * which is what pins the revision reviewers read. A proposal that lands without
 * one still renders — reads fall back to the live document — but is permanently
 * unpinned, so reviewers see edits made after the snapshot was meant to be
 * taken. A missing version is therefore fatal here rather than a null return:
 * the caller's write is abandoned instead of committing an unpinned proposal.
 */
export async function createProposalDocVersion({
  collaborationDocId,
  versionName,
  meta,
  operation,
  failureMessage,
}: {
  collaborationDocId: string;
  versionName: string;
  meta?: Record<string, unknown>;
  /** Service name the failure is logged against. */
  operation: string;
  /** User-facing message when the version cannot be minted. */
  failureMessage: string;
}): Promise<number> {
  let version: TipTapVersion | null;

  try {
    version = await getTipTapClient().createVersion(collaborationDocId, {
      name: versionName,
      ...(meta ? { meta } : {}),
    });
  } catch (error: unknown) {
    logger.error(`[${operation}] Failed to create TipTap version`, {
      collaborationDocId,
      error,
    });
    throw new CommonError(failureMessage);
  }

  if (version?.version == null) {
    logger.error(`[${operation}] TipTap created no version for document`, {
      collaborationDocId,
    });
    throw new CommonError(failureMessage);
  }

  return version.version;
}
