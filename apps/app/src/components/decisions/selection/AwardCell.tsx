'use client';

import { formatCurrency } from '@/utils/formatting';
import { getCurrencySymbol } from '@op/common/client';
import { NumberField } from '@op/sense/NumberField';
import { cn } from '@op/sense/lib/utils';

import { useTranslations } from '@/lib/i18n';

import type { ProposalAwards } from '../useProposalAwards';
import { AdvanceToggleButton } from './AdvanceToggleButton';

interface AwardCellProps {
  proposalId: string;
  title: string;
  awards: ProposalAwards;
  isSelected: boolean;
  onToggle: () => void;
  className?: string;
}

export const AwardCell = ({
  proposalId,
  title,
  awards,
  isSelected,
  onToggle,
  className,
}: AwardCellProps) => {
  const t = useTranslations('decisions.review');
  const amount = awards.amounts.get(proposalId) ?? null;
  const requested = awards.getRequested(proposalId);
  const currency = awards.getCurrency(proposalId);
  const showRequested =
    requested !== undefined && awards.hasAdjusted(proposalId);
  const showError = isSelected && !awards.isValid(proposalId);

  return (
    <div
      className={cn(
        'flex flex-wrap items-start justify-end gap-x-3 gap-y-2',
        className,
      )}
    >
      <span
        className={cn(
          'self-center text-sm text-muted-foreground',
          !showRequested && 'sr-only',
        )}
        aria-live="polite"
      >
        {showRequested
          ? t('requestedAmount', {
              amount: formatCurrency(
                requested.amount,
                undefined,
                requested.currency,
              ),
            })
          : ''}
      </span>
      <NumberField
        aria-label={t('awardForProposalLabel', { title })}
        prefixText={getCurrencySymbol(currency)}
        value={amount}
        onChange={(next) => awards.setAmount(proposalId, next)}
        errorMessage={showError ? t('awardedAmountError') : undefined}
        className="w-40 shrink-0"
      />
      <AdvanceToggleButton
        isSelected={isSelected}
        title={title}
        onPress={onToggle}
      />
    </div>
  );
};
