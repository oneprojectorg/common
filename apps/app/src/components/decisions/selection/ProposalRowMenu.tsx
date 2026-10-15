'use client';

import type { Proposal } from '@op/common/client';

import { useTranslations } from '@/lib/i18n';

import { useProposalCardDialogs } from '../ProposalCardDialogContext';
import { ProposalOptionsMenu } from '../ProposalOptionsMenu';
import { buildMergeMenuItem } from '../proposals/merge';

/** The `…` menu at the end of an advance table row, shown on row hover. */
export const ProposalRowMenu = ({
  proposal,
  isSelected,
}: {
  proposal: Proposal;
  isSelected: boolean;
}) => {
  const t = useTranslations();
  const { openMergeDialog } = useProposalCardDialogs();

  // A merged proposal can't be advanced.
  if (isSelected) {
    return null;
  }

  return (
    <div className="transition-opacity motion-reduce:transition-none pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:focus-within:opacity-100 pointer-fine:has-aria-expanded:opacity-100">
      <ProposalOptionsMenu
        groups={[
          [
            buildMergeMenuItem({
              isDisabled: false,
              mergeLabel: t('decisions.proposals.mergeProposalAction'),
              onMerge: () => openMergeDialog(proposal),
            }),
          ],
        ]}
        label={t('decisions.proposals.proposalOptionsLabel')}
        triggerProps={{ variant: 'outline', size: 'icon-sm' }}
      />
    </div>
  );
};
