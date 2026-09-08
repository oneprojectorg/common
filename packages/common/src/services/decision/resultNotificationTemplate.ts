import { z } from 'zod';

import { DEFAULT_MONEY_CURRENCY, isValidCurrencyCode } from '../../money';
import type { BudgetData } from './proposalDataSchema';

// `amount` is omitted until something writes
// `decision_process_result_selections.allocated`; until then it could only
// resolve to ''.
export const RESULT_NOTIFICATION_TOKENS = ['name', 'proposal'] as const;

export type ResultNotificationToken =
  (typeof RESULT_NOTIFICATION_TOKENS)[number];

export const resultNotificationToken = (token: ResultNotificationToken) =>
  `{{${token}}}`;

export const RESULT_NOTIFICATION_MESSAGE_MAX_LENGTH = 4000;

const resultNotificationMessageSchema = z
  .string()
  .trim()
  .min(1)
  .max(RESULT_NOTIFICATION_MESSAGE_MAX_LENGTH);

export const resultNotificationMessagesSchema = z.object({
  selected: resultNotificationMessageSchema,
  notSelected: resultNotificationMessageSchema,
});

export type ResultNotificationMessages = z.infer<
  typeof resultNotificationMessagesSchema
>;

export type ResultNotificationOutcome = 'selected' | 'notSelected';

export type ResultNotificationValues = {
  name: string;
  proposal: string;
  amount: string;
};

// One pass with a replacer: chained `replaceAll`s would let a proposal title
// containing `{{name}}` expand on the next pass.
const TOKEN_PATTERN = new RegExp(
  `\\{\\{(${RESULT_NOTIFICATION_TOKENS.join('|')})\\}\\}`,
  'g',
);

/** Anything else in double braces is left exactly as typed. */
export function renderResultNotificationMessage({
  template,
  values,
}: {
  template: string;
  values: ResultNotificationValues;
}): string {
  return template.replace(
    TOKEN_PATTERN,
    (_match, token: ResultNotificationToken) => values[token],
  );
}

export function selectResultNotificationTemplate({
  messages,
  outcome,
}: {
  messages: ResultNotificationMessages;
  outcome: ResultNotificationOutcome;
}): string {
  return outcome === 'selected' ? messages.selected : messages.notSelected;
}

/**
 * Never falls back to the requested budget: that would tell a selected author
 * they were awarded exactly what they asked for, in an email we can't take
 * back.
 */
export function formatResultAmount({
  allocated,
  budget,
}: {
  allocated: string | null;
  budget: BudgetData | undefined;
}): string {
  const amount = allocated === null ? null : Number(allocated);

  if (amount === null || !Number.isFinite(amount)) {
    return '';
  }

  const currency = budget?.currency;

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: isValidCurrencyCode(currency) ? currency : DEFAULT_MONEY_CURRENCY,
    minimumFractionDigits: 0,
  }).format(amount);
}
