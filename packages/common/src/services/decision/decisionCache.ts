import { invalidate, invalidateMultiple } from '@op/cache';

/**
 * Cache-key suffixes for everything we cache under `type: 'decision'`. Centralized
 * so writers don't drift from readers: if a getter adds a new suffix, add it here
 * and every mutation that already calls `invalidateDecisionInstance` will drop it.
 */
const DECISION_CACHE_KEYS = ['instance', 'categories', 'submitters'] as const;

/**
 * Invalidate every cached projection of a decision instance — the instance
 * snapshot (`getInstance`), the categories list (`getProcessCategories`), and
 * the participation face-pile (`listProposalSubmitters`). Call from any
 * mutation that touches `processInstances`, `decisionProcesses`, the linked
 * profile, or any of this instance's proposals.
 */
export const invalidateDecisionInstance = (instanceId: string) =>
  invalidateMultiple({
    type: 'decision',
    paramsList: DECISION_CACHE_KEYS.map((suffix) => [instanceId, suffix]),
  });

/**
 * Invalidate only the participation face-pile for an instance. Use for proposal
 * mutations that change submitter/visibility but not the instance config — e.g.
 * a draft toggled to submitted bumps `proposalCount`, so callers that need to
 * invalidate the instance snapshot too should use `invalidateDecisionInstance`.
 */
export const invalidateDecisionSubmitters = (instanceId: string) =>
  invalidate({
    type: 'decision',
    params: [instanceId, 'submitters'],
  });
