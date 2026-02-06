'use client';

import { useCollaborativeField } from '@/hooks/useCollaborativeField';
import { Button } from '@op/ui/Button';
import { NumberField } from '@op/ui/NumberField';
import { useEffect, useRef } from 'react';

import { useTranslations } from '@/lib/i18n';

import { useCollaborativeDoc } from './CollaborativeDocContext';

interface CollaborativeBudgetFieldProps {
  /** Maximum allowed budget (for placeholder text) */
  budgetCapAmount?: number;
  /** Initial value from the database (used before Yjs syncs) */
  initialValue?: number | null;
  /** Called when the value changes — use for DB persistence */
  onChange?: (budget: number | null) => void;
}

/**
 * Collaborative budget input synced via Yjs Y.Map.
 * Shows an "Add budget" pill button when no budget is set,
 * then reveals the number input. Changes sync in real time
 * across all connected users.
 */
export function CollaborativeBudgetField({
  budgetCapAmount,
  initialValue = null,
  onChange,
}: CollaborativeBudgetFieldProps) {
  const t = useTranslations();
  const { ydoc } = useCollaborativeDoc();
  const budgetInputRef = useRef<HTMLInputElement>(null);

  const [budget, setBudget] = useCollaborativeField<number | null>(
    ydoc,
    'budget',
    initialValue,
  );

  // Show the input if a value exists (either from init or remote Yjs update)
  const showInput = budget !== null;

  // Auto-focus when input first appears via the "Add budget" button
  const justRevealedRef = useRef(false);
  useEffect(() => {
    if (justRevealedRef.current && budgetInputRef.current) {
      budgetInputRef.current.focus();
      justRevealedRef.current = false;
    }
  });

  const handleChange = (value: number | null) => {
    setBudget(value);
    onChange?.(value);
  };

  const handleReveal = () => {
    // Set to 0 so the input renders, then immediately clear to null
    // so the user sees an empty input. The Yjs field gets set to 0
    // briefly but that's fine — the user will type a real value.
    justRevealedRef.current = true;
    setBudget(0);
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
      value={budget}
      onChange={handleChange}
      prefixText="$"
      inputProps={{
        placeholder: budgetCapAmount
          ? `Max ${budgetCapAmount.toLocaleString()}`
          : t('Enter amount'),
      }}
      fieldClassName="w-auto"
    />
  );
}
