import { db } from '@op/db/client';
import { ProposalReviewRequestState } from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { NotFoundError } from '../../utils';
import { loadProposalForReviewRead } from '../decision/reviewHelpers';
import type { SupportedLocale } from './locales';
import { runTranslateBatch } from './runTranslateBatch';

/** Translates the author's note on a resubmitted revision request for anyone who can read the proposal's revision notes. */
export async function translateRevisionNote({
  requestId,
  targetLocale,
  user,
}: {
  requestId: string;
  targetLocale: SupportedLocale;
  user: User;
}): Promise<{
  responseComment: string | undefined;
  sourceLocale: string;
  targetLocale: SupportedLocale;
}> {
  const request = await db.query.proposalReviewRequests.findFirst({
    where: { id: requestId, state: ProposalReviewRequestState.RESUBMITTED },
    columns: { id: true, responseComment: true },
    with: { assignment: { columns: { proposalId: true } } },
  });

  if (!request) {
    throw new NotFoundError('Revision note', requestId);
  }

  await loadProposalForReviewRead({
    proposalId: request.assignment.proposalId,
    subject: 'revision notes',
    user,
    with: {},
  });

  if (!request.responseComment?.trim()) {
    return { responseComment: undefined, sourceLocale: '', targetLocale };
  }

  const [result] = await runTranslateBatch(
    [
      {
        contentKey: `revision_request:${request.id}:response_comment`,
        text: request.responseComment,
      },
    ],
    targetLocale,
  );

  return {
    responseComment: result?.translatedText,
    sourceLocale: result?.sourceLocale ?? '',
    targetLocale,
  };
}
