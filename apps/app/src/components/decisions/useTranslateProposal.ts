'use client';

import { trpc } from '@op/api/client';
import type { Proposal } from '@op/common/client';
import { useMemo } from 'react';

import type { ProposalTranslation } from './ProposalPreview';
import { getProposalDetectionText } from './translationDetectionText';
import { useTranslateLink } from './useTranslateLink';

/**
 * The proposal page's "See translation" link: the same link as the proposal
 * card's, translating the whole proposal — title, categories and every
 * free-text answer — through `translateProposal`.
 *
 * Shared by every screen that renders one proposal as a page (the proposal
 * route, its sheet, and the admin review summary), so each offers the same
 * control. Each starts in the original language.
 */
export const useTranslateProposal = (proposal: Proposal) => {
  const detectionText = useMemo(
    () => getProposalDetectionText(proposal),
    [proposal],
  );

  const translateMutation = trpc.translation.translateProposal.useMutation();

  const link = useTranslateLink({
    detectionText,
    enabled: true,
    request: (targetLocale) =>
      translateMutation
        .mutateAsync({ profileId: proposal.profileId, targetLocale })
        // Nothing translated comes back as `{}` — a failure, as on the card.
        .then(({ translated }) =>
          Object.keys(translated).length > 0 ? translated : undefined,
        ),
  });

  const translation: ProposalTranslation | undefined = link.translation && {
    htmlContent: link.translation,
    sourceLanguageName: link.sourceLanguageName,
    onViewOriginal: link.showOriginal,
  };

  return {
    /** Pass to `ProposalTranslateLink`. */
    link,
    /** Pass straight to `ProposalPreview`'s `translation` prop. */
    translation,
  };
};
