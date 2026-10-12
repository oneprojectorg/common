'use client';

import { trpc } from '@op/api/client';
import type { Proposal } from '@op/common/client';
import { useMemo } from 'react';

import { getProposalDetectionText } from '../translationDetectionText';
import { useTranslateLink } from '../useTranslateLink';

/**
 * One card's own "See translation": the card's title and preview, translated
 * through `translateProposals` for just this proposal.
 *
 * Each card detects its own language, so a grid can offer translation on the
 * Spanish card and not on the English one beside it.
 */
export const useProposalCardTranslation = ({
  proposal,
  enabled = true,
}: {
  proposal: Proposal;
  /** Off where the card can't host the link (the whole card is a control). */
  enabled?: boolean;
}) => {
  const { profileId } = proposal;
  const detectionText = useMemo(
    () => (enabled ? getProposalDetectionText(proposal) : ''),
    [enabled, proposal],
  );

  const translateMutation = trpc.translation.translateProposals.useMutation();

  return useTranslateLink({
    detectionText,
    enabled,
    request: (targetLocale) =>
      translateMutation
        .mutateAsync({ profileIds: [profileId], targetLocale })
        .then((data) => data.translations[profileId]),
  });
};
