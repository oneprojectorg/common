'use client';

import { useCollaborativeField } from '@/hooks/useCollaborativeField';
import { Button } from '@op/ui/Button';
import { NumberField } from '@op/ui/NumberField';
import { useEffect, useRef, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import { useCollaborativeDoc } from './CollaborativeDocContext';

/**
 * Yjs-synced budget shape — currency + amount as an atomic value
 * TODO: the backend part will be done separately once we have more clarity how it's going to be used.
 */
interface BudgetValue {
  currency: string;
  amount: number;
}

const DEFAULT_CURRENCY = 'USD';
const DEFAULT_CURRENCY_SYMBOL = '$';

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: DEFAULT_CURRENCY_SYMBOL,
};

interface CollaborativeBudgetFieldProps {
  budgetCapAmount?: number;
  initialValue?: number | null;
  onChange?: (budget: number | null) => void;
}

/**
 * Collaborative budget input synced via Yjs Y.Map.
 * Stores `{ currency, amount }` in the shared doc for future
 * multi-currency support.
 */
export function CollaborativeBudgetField({
  budgetCapAmount,
  initialValue = null,
  onChange,
}: CollaborativeBudgetFieldProps) {
  const t = useTranslations();
  const { ydoc } = useCollaborativeDoc();
  const budgetInputRef = useRef<HTMLInputElement>(null);

  const initialBudgetValue =
    initialValue !== null
      ? { currency: DEFAULT_CURRENCY, amount: initialValue }
      : null;

  const [budget, setBudget] = useCollaborativeField<BudgetValue | null>(
    ydoc,
    'budget',
    initialBudgetValue,
  );

  const onChangeRef = useRef(onChange);
  const lastEmittedAmountRef = useRef<number | null | undefined>(undefined);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const [isRevealed, setIsRevealed] = useState(initialValue !== null);
  const showInput = isRevealed || budget !== null;
  const budgetAmount = budget?.amount ?? null;
  const currencySymbol =
    CURRENCY_SYMBOLS[budget?.currency ?? DEFAULT_CURRENCY] ??
    DEFAULT_CURRENCY_SYMBOL;

  // Auto-focus when input first appears via the "Add budget" button
  const justRevealedRef = useRef(false);
  useEffect(() => {
    if (justRevealedRef.current && budgetInputRef.current) {
      budgetInputRef.current.focus();
      justRevealedRef.current = false;
    }
  });

  const handleChange = (value: number | null) => {
    if (value === null) {
      setBudget(null);
    } else {
      setBudget({
        currency: budget?.currency ?? DEFAULT_CURRENCY,
        amount: value,
      });
    }
  };

  useEffect(() => {
    if (lastEmittedAmountRef.current === budgetAmount) {
      return;
    }

    lastEmittedAmountRef.current = budgetAmount;
    onChangeRef.current?.(budgetAmount);
  }, [budgetAmount]);

  const handleReveal = () => {
    justRevealedRef.current = true;
    setIsRevealed(true);
  };

  if (!showInput) {
    return (
      <Button variant="pill" color="pill" onPress={handleReveal}>
        {t('Add budget')}
      </Button>
    );
  }

  return (
    <NumberField
      ref={budgetInputRef}
      value={budgetAmount}
      onChange={handleChange}
      prefixText={currencySymbol}
      inputProps={{
        placeholder: budgetCapAmount
          ? t('Max {amount}', {
              amount: budgetCapAmount.toLocaleString(),
            })
          : t('Enter amount'),
      }}
      fieldClassName="w-auto"
    />
  );
}
