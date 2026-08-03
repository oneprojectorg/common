'use client';

import { ProposalTemplateSchema } from '@op/common';
import { CollapsibleConfigCard } from '@op/sense/CollapsibleConfigCard';
import { Field, FieldLabel } from '@op/sense/Field';
import { NumberField } from '@op/sense/NumberField';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@op/sense/Select';
import { Switch } from '@op/sense/Switch';
import type { Key } from 'react';
import { useCallback } from 'react';
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
            <NumberField
              id="budget-max"
              label={t('Max budget')}
              prefixText={budgetCurrencySymbol}
              placeholder={t('Set maximum budget')}
              value={budgetMaxAmount ?? null}
              onChange={handleBudgetMaxChange}
            />
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
