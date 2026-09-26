import { describe, expect, it, vi } from 'vitest';

// The module graph reaches `@op/db/client`, which pulls in `server-only` and
// can't load under Vitest. These cases only exercise the non-collaborative
// branch, which touches neither the database nor TipTap.
vi.mock('@op/db/client', () => ({
  db: {},
  and: vi.fn(),
  eq: vi.fn(),
  sql: vi.fn(),
}));

vi.mock('@op/collab', () => ({
  getTipTapClient: vi.fn(),
}));

import type { ProposalTemplateSchema, XFormatPropertySchema } from './types';
import { validateProposalAgainstTemplate } from './validateProposalAgainstTemplate';

const AUTHOR = { profileId: '11111111-1111-4111-8111-111111111111' };

const template = (budget: XFormatPropertySchema): ProposalTemplateSchema => ({
  type: 'object',
  properties: {
    title: { type: 'string', 'x-format': 'short-text' },
    budget,
  },
  required: ['title'],
});

/** How the Process Builder writes a currency-kind budget field. */
const currencyBudgetField: XFormatPropertySchema = {
  type: 'object',
  title: 'Budget',
  'x-format': 'money',
  'x-unit': { kind: 'currency', code: 'EUR' },
  properties: {
    amount: { type: 'number' },
    currency: { type: 'string', const: 'EUR', default: 'EUR' },
  },
  required: ['amount', 'currency'],
  additionalProperties: false,
};

/** A custom-kind field declares no `currency` property at all. */
const customBudgetField: XFormatPropertySchema = {
  type: 'object',
  title: 'Budget',
  'x-format': 'money',
  'x-unit': { kind: 'custom', label: 'points' },
  properties: { amount: { type: 'number' } },
  required: ['amount'],
  additionalProperties: false,
};

const validate = (
  budgetField: XFormatPropertySchema,
  budget: unknown,
): Promise<Record<string, unknown> | null> =>
  validateProposalAgainstTemplate(
    template(budgetField),
    { title: 'Community Garden Revamp', budget },
    undefined,
    AUTHOR,
  );

describe('validateProposalAgainstTemplate budget shaping', () => {
  // Storage makes `currency` optional; the template may still require it.
  it('accepts a bare amount against a currency-kind template that requires currency', async () => {
    await expect(validate(currencyBudgetField, { amount: 90 })).resolves.toBe(
      null,
    );
  });

  it('accepts a legacy plain number against a currency-kind template', async () => {
    await expect(validate(currencyBudgetField, 90)).resolves.toBe(null);
  });

  // A value left over from before the template moved off currency must not
  // fail `additionalProperties: false`.
  it('accepts a currency-stamped amount against a custom-kind template', async () => {
    await expect(
      validate(customBudgetField, { amount: 90, currency: 'USD' }),
    ).resolves.toBe(null);
  });

  it('accepts a bare amount against a custom-kind template', async () => {
    await expect(validate(customBudgetField, { amount: 90 })).resolves.toBe(
      null,
    );
  });

  // Reshaping must not swallow a value the template should reject.
  it('rejects a budget that is not an amount at all', async () => {
    await expect(
      validate(customBudgetField, { note: 'about three hundred' }),
    ).rejects.toMatchObject({ name: 'ValidationError' });
  });
});
