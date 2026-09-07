import { z } from 'zod';

import { DEFAULT_MONEY_CURRENCY, isValidCurrencyCode } from '../../money';
import { normalizeBudget } from './proposalDataSchema';

/** The placeholders an admin may use in a results notification message. */
export const RESULT_NOTIFICATION_TOKENS = [
  'name',
  'proposal',
  'amount',
] as const;

export type ResultNotificationToken =
  (typeof RESULT_NOTIFICATION_TOKENS)[number];

/** How a token is written in a message body. */
export const resultNotificationToken = (token: ResultNotificationToken) =>
  `{{${token}}}`;

/** Longest message the compose dialog accepts, enforced service-side too. */
export const RESULT_NOTIFICATION_MESSAGE_MAX_LENGTH = 4000;

const resultNotificationMessageSchema = z
  .string()
  .trim()
  .min(1)
  .max(RESULT_NOTIFICATION_MESSAGE_MAX_LENGTH);

/**
 * The two message bodies an admin composes when publishing final results. One
 * definition for the tRPC input, the service gate, and the compose dialog, so
 * the cap and the blank rule can't drift between them.
 */
export const resultNotificationMessagesSchema = z.object({
  funded: resultNotificationMessageSchema,
  notFunded: resultNotificationMessageSchema,
});

export type ResultNotificationMessages = z.infer<
  typeof resultNotificationMessagesSchema
>;

export type ResultNotificationValues = {
  /** The author's display name; empty when the account carries none. */
  name: string;
  /** The proposal's title. */
  proposal: string;
  /**
   * The formatted allocation, or '' when the process collects no budgets.
   * Empty rather than a bare currency symbol: a message reading "awarded $"
   * is worse than one reading "awarded ".
   */
  amount: string;
};

// One pass, one replacer. Chained `replaceAll`s would let an
// attacker-controlled proposal title containing `{{name}}` expand on the next
// pass into text that reads as admin-authored copy.
const TOKEN_PATTERN = new RegExp(
  `\\{\\{(${RESULT_NOTIFICATION_TOKENS.join('|')})\\}\\}`,
  'g',
);

/**
 * Substitutes `{{name}}` / `{{proposal}}` / `{{amount}}` in an admin-authored
 * message. Anything else in double braces is left exactly as typed — a typo
 * should look like a typo, not silently vanish.
 */
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

/**
 * The template a recipient's copy is rendered from. Pairing outcome to message
 * lives here rather than at the send site so it is unit-testable — swapping the
 * two mails "you were funded" to every rejected author, irreversibly, and
 * `services/workflows` has no test harness to catch it.
 */
export function selectResultNotificationTemplate({
  messages,
  outcome,
}: {
  messages: ResultNotificationMessages;
  outcome: 'funded' | 'notFunded';
}): string {
  return outcome === 'funded' ? messages.funded : messages.notFunded;
}

/**
 * The string `{{amount}}` resolves to: the awarded figure, or '' when there
 * isn't one.
 *
 * Deliberately does NOT fall back to the proposal's requested budget. Nothing
 * writes `decision_process_result_selections.allocated` yet, so a fallback
 * would tell every funded author they were awarded exactly what they asked
 * for — a number the process never committed to, in an email that can't be
 * taken back. Empty reads as unfinished; a wrong figure reads as a promise.
 */
export function formatResultAmount({
  allocated,
  budget,
}: {
  allocated: string | null;
  /** Only supplies the currency; never the amount. */
  budget: unknown;
}): string {
  const amount = allocated === null ? null : Number(allocated);

  if (amount === null || !Number.isFinite(amount)) {
    return '';
  }

  const currency = normalizeBudget(budget)?.currency;

  // Emails carry no recipient locale, so the whole send path is en-US.
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: isValidCurrencyCode(currency) ? currency : DEFAULT_MONEY_CURRENCY,
    minimumFractionDigits: 0,
  }).format(amount);
}
