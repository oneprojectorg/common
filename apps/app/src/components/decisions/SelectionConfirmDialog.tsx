'use client';

import { formatCurrency } from '@/utils/formatting';
import type { Proposal } from '@op/common/client';
import { Button } from '@op/ui/Button';
import { Chip } from '@op/ui/Chip';
import { Dialog, DialogTrigger } from '@op/ui/Dialog';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@op/ui/Modal';
import { cn } from '@op/ui/utils';

import { useTranslations } from '@/lib/i18n';

import { Bullet } from '../Bullet';
import {
  ProposalCard,
  ProposalCardCategory,
  ProposalCardContent,
  ProposalCardHeader,
} from './ProposalCard';
import { resolveProposalSystemFields } from './proposalContentUtils';

interface SelectionConfirmDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  proposals: Proposal[];
  count: number;
  phaseName: string;
  onConfirm: () => void;
  isSubmitting: boolean;
  triggerDisabled: boolean;
  /** Override the trigger button label. Defaults to "Confirm decisions". */
  triggerLabel?: string;
  /**
   * `'finalPhase'` renders the funded-results layout from Figma 2310-10152
   * (total allocation block, vote counts on each card, "Notify participants"
   * footer). Defaults to the generic advance-to-next-phase layout.
   */
  variant?: 'standard' | 'finalPhase';
  /**
   * Total budget for the decision. Only used when variant is `'finalPhase'`;
   * drives the allocation progress bar and "$X remaining" label.
   */
  totalBudget?: number;
}

export const SelectionConfirmDialog = ({
  isOpen,
  onOpenChange,
  proposals,
  count,
  phaseName,
  onConfirm,
  isSubmitting,
  triggerDisabled,
  triggerLabel,
  variant = 'standard',
  totalBudget,
}: SelectionConfirmDialogProps) => {
  const t = useTranslations();
  const isFinalPhase = variant === 'finalPhase';

  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={onOpenChange}>
      <Button isDisabled={triggerDisabled} variant="primary">
        {triggerLabel ?? t('Confirm decisions')}
      </Button>

      <Modal isDismissable>
        <Dialog className="h-full">
          <ModalHeader>
            {isFinalPhase
              ? t('Confirm winning proposals')
              : t('Confirm advancing proposals')}
          </ModalHeader>
          <ModalBody>
            {isFinalPhase ? (
              <FinalPhaseReview
                proposals={proposals}
                count={count}
                totalBudget={totalBudget}
              />
            ) : (
              <StandardReview
                proposals={proposals}
                count={count}
                phaseName={phaseName}
              />
            )}
          </ModalBody>
          <ModalFooter>
            <Button
              className="w-full"
              color="primary"
              onPress={onConfirm}
              isDisabled={isSubmitting}
            >
              {isSubmitting
                ? t('Submitting...')
                : isFinalPhase
                  ? t('Notify participants')
                  : t('Publish')}
            </Button>
          </ModalFooter>
        </Dialog>
      </Modal>
    </DialogTrigger>
  );
};

const StandardReview = ({
  proposals,
  count,
  phaseName,
}: {
  proposals: Proposal[];
  count: number;
  phaseName: string;
}) => {
  const t = useTranslations();

  return (
    <div className="space-y-4">
      <p className="text-base text-neutral-charcoal">
        {t(
          'These {numProposals} proposals will move on to the {phaseName} phase',
          { numProposals: count, phaseName },
        )}
      </p>

      <div className="space-y-2">
        <div className="text-sm tracking-wider text-neutral-gray4 uppercase">
          {t('PROPOSALS TO ADVANCE')}
        </div>

        {proposals.map((proposal) => (
          <ProposalCard className="bg-neutral-offWhite p-3" key={proposal.id}>
            <ProposalCardContent>
              <ProposalCardHeader
                className="flex-row flex-wrap justify-between"
                proposal={proposal}
              />
              <div className="flex items-center gap-2">
                <span className="text-sm text-neutral-charcoal">
                  {proposal.submittedBy?.name}
                </span>
                <ProposalCardCategory proposal={proposal} />
              </div>
            </ProposalCardContent>
          </ProposalCard>
        ))}
      </div>
    </div>
  );
};

const FinalPhaseReview = ({
  proposals,
  count,
  totalBudget,
}: {
  proposals: Proposal[];
  count: number;
  totalBudget?: number;
}) => {
  const t = useTranslations();

  const { allocated, currency } = proposals.reduce<{
    allocated: number;
    currency: string | undefined;
  }>(
    (acc, p) => {
      const { budget } = resolveProposalSystemFields(p);
      if (!budget) {
        return acc;
      }
      return {
        allocated: acc.allocated + (Number(budget.amount) || 0),
        currency: acc.currency ?? budget.currency,
      };
    },
    { allocated: 0, currency: undefined },
  );

  return (
    <div className="space-y-4">
      <p className="text-base text-neutral-charcoal">
        {t(
          'These {numProposals} proposals will be funded and results will be shared with all participants.',
          { numProposals: count },
        )}
      </p>

      {allocated > 0 ? (
        <TotalAllocation
          allocated={allocated}
          totalBudget={totalBudget}
          currency={currency ?? 'USD'}
        />
      ) : null}

      <div className="space-y-2">
        {proposals.map((proposal) => (
          <FinalPhaseProposalCard key={proposal.id} proposal={proposal} />
        ))}
      </div>
    </div>
  );
};

const TotalAllocation = ({
  allocated,
  totalBudget,
  currency,
}: {
  allocated: number;
  totalBudget?: number;
  currency: string;
}) => {
  const t = useTranslations();
  const hasBudgetCeiling =
    typeof totalBudget === 'number' && totalBudget > 0 && totalBudget >= allocated;
  const remaining = hasBudgetCeiling ? totalBudget - allocated : 0;
  // Without a ceiling, the bar fills to 100% — there's nothing remaining to plot.
  const fillPercent = hasBudgetCeiling
    ? Math.min(100, Math.round((allocated / totalBudget) * 100))
    : 100;

  return (
    <div className="flex flex-col gap-2 py-2">
      <div className="flex items-end justify-between">
        <span className="font-serif text-title-sm14 text-neutral-black">
          {t('Total allocation')}
        </span>
        <span className="font-serif text-title-sm14 text-neutral-charcoal">
          {formatCurrency(
            hasBudgetCeiling ? totalBudget : allocated,
            undefined,
            currency,
          )}
        </span>
      </div>
      <div className="relative h-1 w-full overflow-hidden rounded-full bg-neutral-gray2">
        <div
          className={cn('absolute inset-y-0 left-0 rounded-full bg-tealGreen')}
          style={{ width: `${fillPercent}%` }}
        />
      </div>
      {hasBudgetCeiling ? (
        <span className="text-sm text-neutral-charcoal">
          {t('{amount} remaining', {
            amount: formatCurrency(remaining, undefined, currency),
          })}
        </span>
      ) : null}
    </div>
  );
};

const FinalPhaseProposalCard = ({ proposal }: { proposal: Proposal }) => {
  const t = useTranslations();
  const { title, budget, category } = resolveProposalSystemFields(proposal);
  const formattedBudget = budget?.amount
    ? formatCurrency(Number(budget.amount), undefined, budget.currency)
    : null;
  const submitterName = proposal.submittedBy?.name;
  const categoryLabel = Array.isArray(category) ? category[0] : category;
  const voteCount = proposal.voteCount ?? 0;

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-neutral-gray1 bg-neutral-offWhite p-3">
      <div className="flex items-start justify-between gap-2">
        <span className="truncate font-serif text-title-sm14 text-neutral-black">
          {title || proposal.profile.name || t('Untitled Proposal')}
        </span>
        {formattedBudget ? (
          <span className="font-serif text-title-sm14 text-neutral-charcoal">
            {formattedBudget}
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
