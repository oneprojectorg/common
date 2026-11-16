'use client';

import { formatCurrency } from '@/utils/formatting';
import { type MoneyAmount, getCurrencySymbol } from '@op/common/client';
import { NumberField } from '@op/sense/NumberField';
import { cn } from '@op/sense/lib/utils';
import { memo } from 'react';

import { useTranslations } from '@/lib/i18n';

import { AdvanceToggleButton } from './AdvanceToggleButton';

export interface AwardCellProps {
  proposalId: string;
  title: string;
  amount: number | null;
  requested: MoneyAmount | undefined;
  currency: string;
  hasAdjusted: boolean;
  isValid: boolean;
  onAmountChange: (proposalId: string, amount: number | null) => void;
  isSelected: boolean;
  onToggle: (proposalId: string) => void;
  className?: string;
}

// Memoized on per-row scalars so one row's keystroke does not re-render every
// other row's controlled NumberField.
export const AwardCell = memo(function AwardCell({
  proposalId,
  title,
  amount,
  requested,
  currency,
  hasAdjusted,
  isValid,
  onAmountChange,
  isSelected,
  onToggle,
  className,
}: AwardCellProps) {
  const t = useTranslations('decisions.review');
  const showRequested = requested !== undefined && hasAdjusted;
  const showError = isSelected && !isValid;

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
        onChange={(next) => onAmountChange(proposalId, next)}
        errorMessage={showError ? t('awardedAmountError') : undefined}
        className="w-40 shrink-0"
      />
      <AdvanceToggleButton
        isSelected={isSelected}
        title={title}
        onPress={() => onToggle(proposalId)}
      />
    </div>
  );
});
