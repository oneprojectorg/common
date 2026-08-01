'use client';

import { ProposalTemplateSchema } from '@op/common';
import { CollapsibleConfigCard } from '@op/sense/CollapsibleConfigCard';
import { Field, FieldLabel } from '@op/sense/Field';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@op/sense/InputGroup';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@op/sense/Select';
import { Switch } from '@op/sense/Switch';
import type { Key } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { LuHash } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import {
  getFieldSchema,
  isFieldRequired,
  setFieldRequired,
} from '../../../proposalTemplate';

const CURRENCIES = [
  { code: 'USD', symbol: '$' },
  { code: 'EUR', symbol: '€' },
  { code: 'GBP', symbol: '£' },
  { code: 'JPY', symbol: '¥' },
  { code: 'CAD', symbol: 'CA$' },
  { code: 'AUD', symbol: 'A$' },
  { code: 'CHF', symbol: 'CHF' },
  { code: 'CNY', symbol: '¥' },
  { code: 'INR', symbol: '₹' },
  { code: 'BRL', symbol: 'R$' },
  { code: 'KRW', symbol: '₩' },
  { code: 'SGD', symbol: 'S$' },
  { code: 'MXN', symbol: 'MX$' },
  { code: 'AED', symbol: 'د.إ' },
  { code: 'SAR', symbol: '﷼' },
] as const;

const CURRENCY_SYMBOL_MAP = new Map<string, string>(
  CURRENCIES.map((c) => [c.code, c.symbol]),
);

// value → label map so base-ui `SelectValue` renders "USD $" instead of the
// raw stored code ("USD").
const CURRENCY_ITEMS: Record<string, string> = Object.fromEntries(
  CURRENCIES.map((c) => [c.code, `${c.code} ${c.symbol}`]),
);

// Numeric-input helpers ported from the former @op/ui NumberField (sense has no
// NumberField equivalent). They normalize non-ASCII numerals to ASCII so the
// field accepts Arabic-Indic / Persian digits, then keep only valid numeric
// characters.
const normalizeDigits = (value: string) =>
  value
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/٫/g, '.') // Arabic decimal separator
    .replace(/٬/g, ''); // Arabic thousands separator

const filterNumericInput = (value: string) =>
  normalizeDigits(value)
    .replace(/[^0-9.-]/g, '') // Keep only digits, minus, and decimal
    .replace(/(?!^)-/g, '') // Remove minus signs that aren't at the beginning
    .replace(/\.(?=.*\.)/g, ''); // Remove decimal points except the last one

const parseNumericValue = (value: string): number | null => {
  const filtered = filterNumericInput(value);
  if (filtered === '' || filtered === '-') {
    return null;
  }
  const parsed = parseFloat(filtered);
  return isNaN(parsed) ? null : parsed;
};

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
  const budgetCurrency =
    (budgetSchema?.properties?.currency as { default?: string } | undefined)
      ?.default ?? 'USD';
  const budgetCurrencySymbol = CURRENCY_SYMBOL_MAP.get(budgetCurrency) ?? '$';
  const budgetMaxAmount = budgetSchema?.maximum as number | undefined;
  const budgetRequired = isFieldRequired(template, 'budget');

  const badgeLabel = showBudget
    ? budgetRequired
      ? t('Required')
      : t('Optional')
    : undefined;

  // Local display string for the max-budget input; synced when the stored
  // value changes externally (mirrors the old NumberField's value → display
  // effect).
  const [budgetMaxDisplay, setBudgetMaxDisplay] = useState(
    budgetMaxAmount?.toString() ?? '',
  );
  useEffect(() => {
    setBudgetMaxDisplay(budgetMaxAmount?.toString() ?? '');
  }, [budgetMaxAmount]);

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
                currency: { type: 'string', default: 'USD' },
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
            <Field>
              <FieldLabel htmlFor="budget-currency">{t('Currency')}</FieldLabel>
              <Select
                value={budgetCurrency}
                onValueChange={(currency) =>
                  handleBudgetCurrencyChange(currency)
                }
                items={CURRENCY_ITEMS}
              >
                <SelectTrigger id="budget-currency" className="w-full bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.code} {c.symbol}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="budget-max">{t('Max budget')}</FieldLabel>
              <InputGroup>
                <InputGroupAddon align="inline-start">
                  {budgetCurrencySymbol}
                </InputGroupAddon>
                <InputGroupInput
                  id="budget-max"
                  inputMode="decimal"
                  dir="ltr"
                  placeholder={t('Set maximum budget')}
                  value={budgetMaxDisplay}
                  onChange={(e) => {
                    const filtered = filterNumericInput(e.target.value);
                    setBudgetMaxDisplay(filtered);
                    handleBudgetMaxChange(parseNumericValue(filtered));
                  }}
                />
              </InputGroup>
            </Field>
          </>
        )}
        <div className="flex items-center justify-between">
          <span className="text-neutral-charcoal">
            {t('Show in template?')}
          </span>
          <Switch
            size="sm"
            checked={showBudget}
            onCheckedChange={handleShowBudgetChange}
            aria-label={t('Show in template?')}
            data-testid="budget-show-in-template-toggle"
          />
        </div>
        {showBudget && (
          <div className="flex items-center justify-between">
            <span className="text-neutral-charcoal">{t('Required?')}</span>
            <Switch
              size="sm"
              checked={budgetRequired}
              onCheckedChange={handleBudgetRequiredChange}
              aria-label={t('Required?')}
            />
          </div>
        )}
      </div>
    </CollapsibleConfigCard>
  );
}
