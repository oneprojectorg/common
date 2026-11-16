import { db } from '@op/db/client';
import type { User } from '@op/supabase/lib';

import { NotFoundError } from '../../utils';
import { loadProposalForReviewRead } from '../decision/reviewHelpers';
import type { SupportedLocale } from './locales';
import { runTranslateBatch } from './runTranslateBatch';

export type RevisionRequestTranslation = {
  requestComment: string | undefined;
  responseComment: string | undefined;
};

/** Translates a revision request and the author's note on it for anyone who can read the proposal's revision requests. */
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
    columns: { id: true, requestComment: true, responseComment: true },
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

  const requestKey = `revision_request:${request.id}:request_comment`;
  const responseKey = `revision_request:${request.id}:response_comment`;
  const entries = [
    { contentKey: requestKey, text: request.requestComment },
    { contentKey: responseKey, text: request.responseComment ?? '' },
  ].filter((entry) => entry.text.trim());

  if (entries.length === 0) {
    return {
      requestComment: undefined,
      responseComment: undefined,
      sourceLocale: '',
      targetLocale,
    };
  }

  const results = await runTranslateBatch(entries, targetLocale);
  const translatedTexts = new Map(
    results.map((result) => [result.contentKey, result.translatedText]),
  );

  return {
    requestComment: translatedTexts.get(requestKey),
    responseComment: translatedTexts.get(responseKey),
    sourceLocale:
      results.find((result) => result.sourceLocale)?.sourceLocale ?? '',
    targetLocale,
  };
}
