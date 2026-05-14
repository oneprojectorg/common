'use client';

import type { Proposal } from '@op/common/client';
import { Chip } from '@op/ui/Chip';
import { FooterBar } from '@op/ui/FooterBar';

import { useTranslations } from '@/lib/i18n';

import { Bullet } from '../Bullet';
import { SelectionConfirmShell } from './SelectionConfirmShell';
import { resolvePresentationFields } from './selection/proposalPresentation';

interface FinalPhaseSelectionFooterProps {
  selectedProposals: Proposal[];
  numSelected: number;
  isConfirmOpen: boolean;
  onConfirmOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isSubmitting: boolean;
}

export const FinalPhaseSelectionFooter = ({
  selectedProposals,
  numSelected,
  isConfirmOpen,
  onConfirmOpenChange,
  onConfirm,
  isSubmitting,
}: FinalPhaseSelectionFooterProps) => {
  const t = useTranslations();

  return (
    <FooterBar position="fixed" className="bg-neutral-offWhite/95">
      <FooterBar.Start>
        <span className="text-base text-neutral-black">
          {t('{count} winning proposals selected', { count: numSelected })}
        </span>
      </FooterBar.Start>
      <FooterBar.Center />
      <FooterBar.End>
        <SelectionConfirmShell
          isOpen={isConfirmOpen}
          onOpenChange={onConfirmOpenChange}
          triggerDisabled={numSelected === 0}
          triggerLabel={
            <>
              <span className="sm:hidden">{t('Confirm')}</span>
              <span className="hidden sm:inline">
                {t('Confirm winning proposals')}
              </span>
            </>
          }
          headerLabel={t('Confirm winning proposals')}
          confirmLabel={t('Publish results')}
          isSubmitting={isSubmitting}
          onConfirm={onConfirm}
        >
          <div className="space-y-4">
            <p className="text-base text-neutral-charcoal">
              {t(
                'These {numProposals} proposals will be funded and results will be shared with all participants.',
                { numProposals: numSelected },
              )}
            </p>

            <div className="space-y-2">
              {selectedProposals.map((proposal) => (
                <FinalPhaseProposalCard key={proposal.id} proposal={proposal} />
              ))}
            </div>
          </div>
        </SelectionConfirmShell>
      </FooterBar.End>
    </FooterBar>
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
