import type { ProposalTemplateSchema, XFormatPropertySchema } from './types';

/** Currency assumed when a template's budget field configures none. */
export const DEFAULT_BUDGET_CURRENCY = 'USD';

/**
 * The ISO 4217 code a template's budget field is configured with.
 *
 * The process builder's currency picker writes it to
 * `properties.budget.properties.currency.default` (see `BudgetFieldConfig`),
 * and the proposal editor stamps it onto the budget fragment the author
 * submits — which is what every renderer reads the currency from. Without it
 * a EUR-denominated process would write `"USD"` into every fragment and
 * faithfully render dollars for all of its proposals.
 *
 * Accepts the budget property schema directly, since the proposal form renders
 * from a field descriptor rather than the whole template; use
 * {@link getTemplateBudgetCurrency} when you hold the template.
 */
export function getBudgetCurrency(
  schema: XFormatPropertySchema | undefined,
): string {
  const currency = schema?.properties?.currency;

  // `typeof null === 'object'`, and templates are arbitrary JSON out of the
  // database — the types don't stop a stored `currency: null` from reaching
  // here. Both callers run during render, so throwing would blank the process
  // builder and the proposal editor into an error boundary.
  if (
    typeof currency === 'object' &&
    currency !== null &&
    typeof currency.default === 'string'
  ) {
    return currency.default;
  }

  return DEFAULT_BUDGET_CURRENCY;
}

/** {@link getBudgetCurrency} for callers holding the whole template. */
export function getTemplateBudgetCurrency(
  template: ProposalTemplateSchema | null | undefined,
): string {
  return getBudgetCurrency(template?.properties?.budget);
}
