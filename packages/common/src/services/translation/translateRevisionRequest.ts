import { db } from '@op/db/client';
import type { User } from '@op/supabase/lib';

import { NotFoundError } from '../../utils';
import { loadProposalForReviewRead } from '../decision/reviewHelpers';
import type { SupportedLocale } from './locales';
import { runTranslateBatch } from './runTranslateBatch';

export type RevisionRequestTranslation = {
  requestComment: string | undefined;
};

/**
 * Translates a revision request's `requestComment`. Gated exactly like
 * `listProposalRevisionRequests` / `listProposalRevisionNotes` — through
 * `loadProposalForReviewRead` on the request's proposal: its authors, decision
 * admins, and REVIEW holders on the instance. The response carries no
 * reviewer identity.
 */
export async function translateRevisionRequest({
  requestId,
  targetLocale,
  user,
}: {
  requestId: string;
  targetLocale: SupportedLocale;
  user: User;
}): Promise<
  RevisionRequestTranslation & {
    sourceLocale: string;
    targetLocale: SupportedLocale;
  }
> {
  const request = await db.query.proposalReviewRequests.findFirst({
    where: { id: requestId },
    columns: { id: true, requestComment: true },
    with: { assignment: { columns: { proposalId: true } } },
  });

  if (!request) {
    throw new NotFoundError('Revision request', requestId);
  }

  await loadProposalForReviewRead({
    proposalId: request.assignment.proposalId,
    subject: 'revision requests',
    user,
    with: {},
  });

  if (!request.requestComment.trim()) {
    return { requestComment: undefined, sourceLocale: '', targetLocale };
  }

  const [result] = await runTranslateBatch(
    [
      {
        contentKey: `revision_request:${request.id}:request_comment`,
        text: request.requestComment,
      },
    ],
    targetLocale,
  );

  return {
    requestComment: result?.translatedText,
    sourceLocale: result?.sourceLocale ?? '',
    targetLocale,
  };
}
