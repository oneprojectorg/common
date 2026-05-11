'use client';

import type { Proposal } from '@op/common/client';
import { Chip } from '@op/ui/Chip';

import { useTranslations } from '@/lib/i18n';

import { Bullet } from '../Bullet';
import { SelectionConfirmShell } from './SelectionConfirmShell';
import { resolvePresentationFields } from './selection/proposalPresentation';

interface FinalPhaseSelectionConfirmDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  proposals: Proposal[];
  count: number;
  onConfirm: () => void;
  isSubmitting: boolean;
  triggerDisabled: boolean;
}

/**
 * Funded-results confirm dialog used at the last phase of a decision (Figma
 * 2310-10152). Shows per-proposal vote counts.
 */
export const FinalPhaseSelectionConfirmDialog = ({
  isOpen,
  onOpenChange,
  proposals,
  count,
  onConfirm,
  isSubmitting,
  triggerDisabled,
}: FinalPhaseSelectionConfirmDialogProps) => {
  const t = useTranslations();

  return (
    <SelectionConfirmShell
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      triggerDisabled={triggerDisabled}
      triggerLabel={t('Confirm winning proposals')}
      headerLabel={t('Confirm winning proposals')}
      confirmLabel={t('Notify participants')}
      isSubmitting={isSubmitting}
      onConfirm={onConfirm}
    >
      <div className="space-y-4">
        <p className="text-base text-neutral-charcoal">
          {t(
            'These {numProposals} proposals will be funded and results will be shared with all participants.',
            { numProposals: count },
          )}
        </p>

        <div className="space-y-2">
          {proposals.map((proposal) => (
            <FinalPhaseProposalCard key={proposal.id} proposal={proposal} />
          ))}
        </div>
      </div>
    </SelectionConfirmShell>
  );
};

const FinalPhaseProposalCard = ({ proposal }: { proposal: Proposal }) => {
  const t = useTranslations();
  const { title, budget, categories, submitterName } =
    resolvePresentationFields({
      proposal,
      defaultTitle: t('Untitled Proposal'),
    });
  const categoryLabel = categories[0];
  const voteCount = proposal.voteCount ?? 0;

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-neutral-gray1 bg-neutral-offWhite p-3">
      <div className="flex items-start justify-between gap-2">
        <span className="truncate font-serif text-title-sm14 text-neutral-black">
          {title}
        </span>
        {budget ? (
          <span className="font-serif text-title-sm14 text-neutral-charcoal">
            {budget}
          </span>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-charcoal">
        {submitterName ? <span>{submitterName}</span> : null}
        {submitterName && categoryLabel ? <Bullet /> : null}
        {categoryLabel ? <Chip>{categoryLabel}</Chip> : null}
        {(submitterName || categoryLabel) && <Bullet />}
        <span>{t('{count} votes', { count: voteCount })}</span>
      </div>
    </div>
  );
};
