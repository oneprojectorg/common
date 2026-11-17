/**
 * Whether a decision calls its categories "districts" in its copy.
 *
 * TODO: This is a hardcoded, per-decision copy override — the Columbus
 * decision refers to its categories as "districts", matched here on its
 * decision slug. Replace this with a proper configurable terminology/labeling
 * mechanism (e.g. per-process category term settings) instead of matching on
 * a hardcoded slug so we don't accrue more of these.
 */
export const usesDistrictCategoryTerm = (
  decisionSlug: string | undefined,
): boolean => decisionSlug === 'columbus';
