'use client';

import { trpc } from '@op/api/client';

import { useTranslateLink } from './useTranslateLink';

/** Translates the author's note on a resubmission; any request it answered identifies it. */
export const useRevisionNoteTranslation = ({
  requestId,
  comment,
}: {
  requestId: string;
  comment: string;
}) => {
  const translateNote = trpc.translation.translateRevisionNote.useMutation();

  return useTranslateLink({
    detectionText: comment,
    request: (targetLocale) =>
      translateNote
        .mutateAsync({ requestId, targetLocale })
        .then(({ responseComment }) => responseComment || undefined),
  });
};
