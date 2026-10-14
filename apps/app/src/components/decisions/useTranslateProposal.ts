'use client';

import { trpc } from '@op/api/client';
import type { Proposal } from '@op/common/client';
import { useMemo } from 'react';

import type { ProposalTranslation } from './ProposalPreview';
import { getProposalDetectionText } from './translationDetectionText';
import { useTranslateLink } from './useTranslateLink';

/** The proposal page's link: translates the whole proposal via `translateProposal`. */
export const useTranslateProposal = (proposal: Proposal) => {
  const detectionText = useMemo(
    () => getProposalDetectionText(proposal),
    [proposal],
  );

  const translateMutation = trpc.translation.translateProposal.useMutation();

  const link = useTranslateLink({
    detectionText,
    request: (targetLocale) =>
      translateMutation
        .mutateAsync({ profileId: proposal.profileId, targetLocale })
        // Nothing translated comes back as `{}`.
        .then(({ translated }) =>
          Object.keys(translated).length > 0 ? translated : undefined,
        ),
  });

  const translation: ProposalTranslation | undefined = link.translation && {
    htmlContent: link.translation,
  };

  return {
    link,
    /** Pass straight to `ProposalPreview`'s `translation` prop. */
    translation,
  };
};
