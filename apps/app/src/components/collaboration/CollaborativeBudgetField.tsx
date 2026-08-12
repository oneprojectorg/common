'use client';

import { useCollaborativeFragment } from '@/hooks/useCollaborativeFragment';
import { formatMoney, getCurrencySymbol } from '@/utils/formatting';
import {
  type BudgetData,
  DEFAULT_BUDGET_CURRENCY,
  type StoredBudget,
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
   * ISO 4217 code for a fragment that names none of its own, stamped onto what
   * the author enters. Every renderer reads the currency back off the
   * fragment, so getting this wrong makes a whole process render the wrong one.
   *
   * Already resolved by the caller through `resolveBudgetFallbackCurrency` —
   * this component must not re-derive it from `initialValue`, which is
   * schema-parsed and therefore carries a fabricated USD for legacy
   * bare-number budgets.
   */
  currency?: string;
  initialValue?: StoredBudget | null;
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
  currency: fallbackCurrency = DEFAULT_BUDGET_CURRENCY,
  initialValue = null,
  onChange,
}: CollaborativeBudgetFieldProps) {
  const t = useTranslations();
  const { ydoc } = useCollaborativeDoc();
  const budgetInputRef = useRef<HTMLInputElement>(null);

  // `||` rather than `??`: a budget stored with a blank code names no currency
  // any more than an absent one does, and seeding the shared fragment with a
  // blank would push it to every renderer that reads the currency back off it.
  const initialBudgetValue: BudgetData | null = useMemo(
    () =>
      initialValue !== null
        ? {
            currency: initialValue.currency || fallbackCurrency,
            amount: initialValue.amount,
          }
        : null,
    [initialValue, fallbackCurrency],
  );

  const [budgetText, setBudgetText] = useCollaborativeFragment(
    ydoc,
    'budget',
    initialBudgetValue ? JSON.stringify(initialBudgetValue) : '',
  );

  // Same parser the cards and detail page read the fragment with, so the
  // editor can't show "Add budget" for a legacy fragment they render a value
  // for. `undefined` means present-but-unreadable as well as absent.
  const budget = parseBudgetFragmentValue(budgetText, fallbackCurrency);
  const setBudget = (newBudget: BudgetData | null) =>
    setBudgetText(newBudget ? JSON.stringify(newBudget) : '');

  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const [isEditing, setIsEditing] = useState(false);
  const budgetAmount = budget?.amount ?? null;
  const currency = budget?.currency ?? fallbackCurrency;
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
    // Re-parsed rather than closing over `budget` so the deps stay primitive —
    // `budget` is a fresh object every render. Same arguments, so display and
    // emit can't disagree.
    const emitted = parseBudgetFragmentValue(budgetText, fallbackCurrency);

    // A fragment we can't read means "unknown", not "cleared". This effect
    // fires on mount, and `useProposalDraft` treats a `null` budget as the
    // author emptying the field — so emitting here would autosave the stored
    // budget away just because someone opened the proposal. Clearing the
    // field deletes the fragment, which arrives as empty text, not as
    // unreadable text.
    if (budgetText && !emitted) {
      return;
    }

    // Compared against the parent's *current* value rather than a ref of what
    // we last sent. `useProposalDraft` resets `draft` to the refetched server
    // proposal, and a ref would still hold the pre-reset key and suppress the
    // re-emit — letting the next save write the stale server budget over the
    // newer one the author can see in the fragment.
    //
    // On the amount alone, because this field has no currency control: a
    // currency difference is never an author edit, only the fragment and the
    // resolved fallback disagreeing. Emitting on it would autosave whichever
    // code an older editor happened to write into the fragment — pinning the
    // proposal to a currency nobody chose, merely because it was opened.
    if (emitted?.amount === initialBudgetValue?.amount) {
      return;
    }

    onChangeRef.current?.(emitted ?? null);
  }, [budgetText, fallbackCurrency, initialBudgetValue]);

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
