'use client';

import { trpc } from '@op/api/client';
import { logger } from '@op/logging/client';
import { toast } from '@op/sense/Toast';
import { useTransition } from 'react';

import { useRouter, useTranslations } from '@/lib/i18n';

import { decisionProposalDevelopHref } from '../proposalHrefs';

/**
 * Creates an entry of the develop phase from one source and opens it in the
 * develop editor. One prepare runs at a time.
 */
export function usePrepareDevelopEntry({
  processInstanceId,
  decisionSlug,
}: {
  processInstanceId: string;
  decisionSlug: string;
}) {
  const t = useTranslations('decisions.develop');
  const router = useRouter();
  const [isNavigating, startNavigating] = useTransition();

  const createEntry = trpc.decision.createDevelopedProposal.useMutation({
    onSuccess: (entry) => {
      startNavigating(() => {
        router.push(
          decisionProposalDevelopHref({
            decisionSlug,
            profileId: entry.profileId,
          }),
        );
      });
    },
    onError: (error) => {
      logger.error('Failed to prepare a develop entry', { error });
      toast.error(t('prepareEntryError'));
    },
  });

  const isPreparing = createEntry.isPending || isNavigating;
  const preparingSourceId = isPreparing
    ? (createEntry.variables?.sourceProposalIds[0] ?? null)
    : null;

  const prepare = (source: { id: string }) => {
    if (isPreparing) {
      return;
    }

    createEntry.mutate({
      processInstanceId,
      sourceProposalIds: [source.id],
      // The server prefills the entry from the source's document.
      proposalData: {},
    });
  };

  return { prepare, isPreparing, preparingSourceId };
}
