'use client';

import { getCurrencySymbol } from '@/utils/formatting';
// `getBudgetCurrency` is a runtime value, so it must come from the client
// entry point — importing it from the `@op/common` barrel would pull the
// server service layer (and its `server-only` deps) into this 'use client'
// component's bundle.
import {
  DEFAULT_BUDGET_CURRENCY,
  type ProposalTemplateSchema,
  getBudgetCurrency,
} from '@op/common/client';
import { CollapsibleConfigCard } from '@op/ui/CollapsibleConfigCard';
import { NumberField } from '@op/ui/NumberField';
import { Select, SelectItem } from '@op/ui/Select';
import { ToggleButton } from '@op/ui/ToggleButton';
import type { Key } from 'react';
import { useCallback, useMemo } from 'react';
import { LuHash } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import {
  getFieldSchema,
  isFieldRequired,
  setFieldRequired,
} from '../../../proposalTemplate';

/**
 * Currencies a process can be denominated in. Symbols come from
 * `getCurrencySymbol` rather than a hand-written map so the picker, this
 * card's max-budget input, and the proposal editor's budget input can't show
 * three different symbols for the same code.
 */
const CURRENCY_CODES = [
  'USD',
  'EUR',
  'GBP',
  'JPY',
  'CAD',
  'AUD',
  'CHF',
  'CNY',
  'INR',
  'BRL',
  'KRW',
  'SGD',
  'MXN',
  'AED',
  'SAR',
] as const;

/**
 * Picker entries, built once. Each is the code plus its symbol when there is
 * one to add — `Intl` returns the code itself for currencies it has no glyph
 * for, which would otherwise render as "CHF CHF".
 *
 * Precomputed at module scope rather than in render: the list is constant, and
 * `getCurrencySymbol` constructs an `Intl.NumberFormat` per code, which this
 * card would otherwise redo on every keystroke in the max-budget field.
 */
const CURRENCY_OPTIONS = CURRENCY_CODES.map((code) => {
  const symbol = getCurrencySymbol(code);
  return { code, label: symbol === code ? code : `${code} ${symbol}` };
});

export function BudgetFieldConfig({
  template,
  onTemplateChange,
}: {
  template: ProposalTemplateSchema;
  onTemplateChange: React.Dispatch<
    React.SetStateAction<ProposalTemplateSchema>
  >;
}) {
  const t = useTranslations();

  const budgetSchema = getFieldSchema(template, 'budget');
  const showBudget = !!budgetSchema;
  const budgetCurrency = getBudgetCurrency(budgetSchema);
  // Memoized: this card re-renders on every keystroke in the max-budget field
  // that consumes the symbol, and resolving it runs an `Intl` format pass.
  const budgetCurrencySymbol = useMemo(
    () => getCurrencySymbol(budgetCurrency),
    [budgetCurrency],
  );
  const budgetMaxAmount = budgetSchema?.maximum as number | undefined;
  const budgetRequired = isFieldRequired(template, 'budget');

  const badgeLabel = showBudget
    ? budgetRequired
      ? t('Required')
      : t('Optional')
    : undefined;

  const handleShowBudgetChange = useCallback(
    (show: boolean) => {
      if (show) {
        onTemplateChange((prev) => ({
          ...prev,
          properties: {
            ...prev.properties,
            budget: {
              type: 'object',
              title: t('Budget'),
              'x-format': 'money',
              properties: {
                amount: { type: 'number' },
                currency: { type: 'string', default: DEFAULT_BUDGET_CURRENCY },
              },
            },
          },
        }));
      } else {
        onTemplateChange((prev) => {
          const { budget: _, ...restProps } = prev.properties ?? {};
          const required = (prev.required ?? []).filter(
            (id) => id !== 'budget',
          );
          return {
            ...prev,
            properties: restProps,
            required: required.length > 0 ? required : undefined,
          };
        });
      }
    },
    [onTemplateChange, t],
  );

  const handleBudgetCurrencyChange = useCallback(
    (key: Key | null) => {
      if (key === null) {
        return;
      }
      onTemplateChange((prev) => {
        const existing = getFieldSchema(prev, 'budget');
        if (!existing) {
          return prev;
        }
        const existingProps = (existing.properties ?? {}) as Record<
          string,
          Record<string, unknown>
        >;
        return {
          ...prev,
          properties: {
            ...prev.properties,
            budget: {
              ...existing,
              properties: {
                ...existingProps,
                currency: {
                  ...(existingProps.currency ?? { type: 'string' }),
                  default: String(key),
                },
              },
            },
          },
        };
      });
    },
    [onTemplateChange],
  );

  const handleBudgetMaxChange = useCallback(
    (value: number | null) => {
      onTemplateChange((prev) => {
        const existing = getFieldSchema(prev, 'budget');
        if (!existing) {
          return prev;
        }
        const updated = { ...existing };
        if (value != null) {
          updated.maximum = value;
        } else {
          delete updated.maximum;
        }
        return {
          ...prev,
          properties: { ...prev.properties, budget: updated },
        };
      });
    },
    [onTemplateChange],
  );

  const handleBudgetRequiredChange = useCallback(
    (required: boolean) => {
      onTemplateChange((prev) => setFieldRequired(prev, 'budget', required));
    },
    [onTemplateChange],
  );

  return (
    <CollapsibleConfigCard
      icon={LuHash}
      label={t('Budget')}
      badgeLabel={badgeLabel}
      isCollapsible
      locked
    >
      <div className="space-y-4 px-8">
        {showBudget && (
          <>
            <Select
              label={t('Currency')}
              selectedKey={budgetCurrency}
              onSelectionChange={handleBudgetCurrencyChange}
              buttonClassName="bg-white"
            >
              {CURRENCY_OPTIONS.map(({ code, label }) => (
                <SelectItem key={code} id={code}>
                  {label}
                </SelectItem>
              ))}
            </Select>
            <NumberField
              label={t('Max budget')}
              value={budgetMaxAmount ?? null}
              onChange={handleBudgetMaxChange}
              prefixText={budgetCurrencySymbol}
              inputProps={{
                placeholder: t('Set maximum budget'),
              }}
            />
          </>
        )}
        <div className="flex items-center justify-between">
          <span className="text-neutral-charcoal">
            {t('Show in template?')}
          </span>
          <ToggleButton
            size="small"
            isSelected={showBudget}
            onChange={handleShowBudgetChange}
            aria-label={t('Show in template?')}
            data-testid="budget-show-in-template-toggle"
          />
        </div>
        {showBudget && (
          <div className="flex items-center justify-between">
            <span className="text-neutral-charcoal">{t('Required?')}</span>
            <ToggleButton
              size="small"
              isSelected={budgetRequired}
              onChange={handleBudgetRequiredChange}
              aria-label={t('Required?')}
            />
          </div>
        )}
      </div>
    </CollapsibleConfigCard>
  );
}
