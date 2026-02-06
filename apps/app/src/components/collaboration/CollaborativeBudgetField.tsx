'use client';

import { useCollaborativeField } from '@/hooks/useCollaborativeField';
import { Button } from '@op/ui/Button';
import { NumberField } from '@op/ui/NumberField';
import { useEffect, useRef, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import { useCollaborativeDoc } from './CollaborativeDocContext';

/** Yjs-synced budget shape — currency + amount as an atomic value */
interface BudgetValue {
  currency: string;
  amount: number;
}

const DEFAULT_CURRENCY = 'USD';

/** Map currency codes to their display symbol */
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
};

interface CollaborativeBudgetFieldProps {
  /** Maximum allowed budget (for placeholder text) */
  budgetCapAmount?: number;
  /** Initial amount from the database (used before Yjs syncs) */
  initialValue?: number | null;
  /** Called when the value changes — passes the raw amount for DB persistence */
  onChange?: (budget: number | null) => void;
}

/**
 * Collaborative budget input synced via Yjs Y.Map.
 * Stores `{ currency, amount }` in the shared doc for future
 * multi-currency support. Currently hardcoded to USD.
 * Shows an "Add budget" pill button when no budget is set,
 * then reveals the number input.
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

  const [isRevealed, setIsRevealed] = useState(initialValue !== null);
  const showInput = isRevealed || budget !== null;
  const currencySymbol =
    CURRENCY_SYMBOLS[budget?.currency ?? DEFAULT_CURRENCY] ?? '$';

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
    onChange?.(value);
  };

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
      value={budget?.amount ?? null}
      onChange={handleChange}
      prefixText={currencySymbol}
      inputProps={{
        placeholder: budgetCapAmount
          ? `Max ${budgetCapAmount.toLocaleString()}`
          : t('Enter amount'),
      }}
      fieldClassName="w-auto"
    />
  );
}
