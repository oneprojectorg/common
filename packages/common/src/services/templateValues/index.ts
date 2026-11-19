/**
 * Filtering and faceting over template answers stored as jsonb.
 *
 * Store-agnostic on purpose: every builder takes the answers map as a jsonb
 * expression, so pointing the same code at `decision_proposals.proposal_data`
 * needs a different expression and nothing else.
 */
export * from './criteria';
export * from './facets';
export * from './sql';
