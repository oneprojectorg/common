'use client';

import { useCollaborativeFragment } from '@/hooks/useCollaborativeFragment';
import { formatMoney, getCurrencySymbol } from '@/utils/formatting';
import {
  type BudgetData,
  DEFAULT_BUDGET_CURRENCY,
  parseBudgetFragmentValue,
} from '@op/common/client';
import { Button } from '@op/ui/Button';
import { NumberField } from '@op/ui/NumberField';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import { useCollaborativeDoc } from './CollaborativeDocContext';

interface CollaborativeBudgetFieldProps {
  minAmount?: number;
  maxAmount?: number;
  /**
   * ISO 4217 code the template is configured with, stamped onto what the
   * author enters. Every renderer reads the currency back off the fragment,
   * so getting this wrong makes a whole process render the wrong currency.
   */
  currency?: string;
  initialValue?: BudgetData | null;
  onChange?: (budget: BudgetData | null) => void;
}

/**
 * Collaborative budget input synced via Yjs XmlFragment.
 * Stores `MoneyAmount` (`{ amount, currency }`) as a JSON string in the shared doc
 * for future multi-currency support.
 *
 * Displays as a pill when a value exists or empty, switching to an inline
 * NumberField on click for editing. The pill width matches the input width
 * to prevent layout shifts.
 */
export function CollaborativeBudgetField({
  minAmount,
  maxAmount,
  currency: templateCurrency = DEFAULT_BUDGET_CURRENCY,
  initialValue = null,
  onChange,
}: CollaborativeBudgetFieldProps) {
  const t = useTranslations();
  const { ydoc } = useCollaborativeDoc();
  const budgetInputRef = useRef<HTMLInputElement>(null);

  const initialBudgetValue =
    initialValue !== null
      ? { currency: initialValue.currency, amount: initialValue.amount }
      : null;

  const [budgetText, setBudgetText] = useCollaborativeFragment(
    ydoc,
    'budget',
    initialBudgetValue ? JSON.stringify(initialBudgetValue) : '',
  );

  // Same parser the cards and detail page read the fragment with, so the
  // editor can't show "Add budget" for a legacy fragment they render a value
  // for. `undefined` means present-but-unreadable as well as absent.
  const budget = parseBudgetFragmentValue(budgetText, templateCurrency);
  const setBudget = (newBudget: BudgetData | null) =>
    setBudgetText(newBudget ? JSON.stringify(newBudget) : '');

  const onChangeRef = useRef(onChange);
  const lastEmittedRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const [isEditing, setIsEditing] = useState(false);
  const budgetAmount = budget?.amount ?? null;
  const currency = budget?.currency ?? templateCurrency;
  const currencySymbol = useMemo(() => getCurrencySymbol(currency), [currency]);

  const placeholderText = maxAmount
    ? t('Max {amount}', { amount: maxAmount.toLocaleString() })
    : t('Enter amount');

  // Size the input to its placeholder text instead of the default size=20
  useLayoutEffect(() => {
    if (budgetInputRef.current) {
      budgetInputRef.current.size = placeholderText.length;
    }
  }, [placeholderText]);

  // Use the larger of the input and button natural widths so both match
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [sharedWidth, setSharedWidth] = useState(0);

  useEffect(() => {
    if (isEditing) {
      return;
    }
    const frame = requestAnimationFrame(() => {
      const group = budgetInputRef.current?.closest('[role="group"]');
      const inputW = group instanceof HTMLElement ? group.offsetWidth : 0;
      const buttonW = buttonRef.current?.scrollWidth ?? 0;
      const width = Math.max(inputW, buttonW);
      if (width > 0) {
        setSharedWidth(width);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [isEditing]);

  useEffect(() => {
    if (isEditing && budgetInputRef.current) {
      budgetInputRef.current.focus();
    }
  }, [isEditing]);

  const handleChange = (value: number | null) => {
    if (value === null) {
      setBudget(null);
    } else {
      setBudget({
        currency,
        amount: value,
      });
    }
  };

  useEffect(() => {
    // Note the fallback: the *stored* currency, not the template's. A currency
    // taken from the template is a display default we inferred, not something
    // the author chose. Emitting it would make `useProposalDraft` see a change
    // and autosave a new currency onto the proposal just because someone
    // opened the editor — on a EUR process, every legacy USD budget would
    // silently become EUR on open. Once the author actually edits the amount,
    // `handleChange` writes the display currency into the fragment explicitly,
    // and that emits normally.
    const emitted = parseBudgetFragmentValue(
      budgetText,
      initialValue?.currency ?? templateCurrency,
    );

    // A fragment we can't read means "unknown", not "cleared". This effect
    // fires on mount, and `useProposalDraft` treats a `null` budget as the
    // author emptying the field — so emitting here would autosave the stored
    // budget away just because someone opened the proposal. Clearing the
    // field deletes the fragment, which arrives as empty text, not as
    // unreadable text.
    if (budgetText && !emitted) {
      return;
    }

    const key = emitted ? `${emitted.amount}:${emitted.currency}` : null;

    if (lastEmittedRef.current === key) {
      return;
    }

    lastEmittedRef.current = key ?? undefined;
    onChangeRef.current?.(emitted ?? null);
  }, [budgetText, templateCurrency, initialValue?.currency]);

  const handleStartEditing = () => {
    setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
  };

  return (
    <>
      <div
        className={
          isEditing ? 'max-w-md' : 'pointer-events-none absolute opacity-0'
        }
        style={sharedWidth > 0 ? { minWidth: sharedWidth } : undefined}
      >
        <NumberField
          ref={budgetInputRef}
          value={budgetAmount}
          onChange={handleChange}
          minValue={minAmount ?? 0}
          maxValue={maxAmount}
          prefixText={currencySymbol}
          inputProps={{
            placeholder: placeholderText,
            onBlur: handleBlur,
            className: 'shadow-none',
          }}
          fieldClassName="rounded-lg"
        />
      </div>
      {!isEditing && (
        <Button
          ref={buttonRef}
          variant="pill"
          color="pill"
          onPress={handleStartEditing}
          className="justify-start text-start"
        >
          {budgetAmount !== null
            ? formatMoney({ amount: budgetAmount, currency })
            : t('Add budget')}
        </Button>
      )}
    </>
  );
}
