'use client';

import { trpc } from '@op/api/client';
import type { Proposal } from '@op/common/client';
import { useMemo } from 'react';

import { getProposalDetectionText } from '../translationDetectionText';
import { useTranslateLink } from '../useTranslateLink';

export const useProposalCardTranslation = ({
  proposal,
  enabled = true,
}: {
  proposal: Proposal;
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
