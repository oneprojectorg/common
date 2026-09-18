import type { RouterInput } from '@op/api/client';

type UpdateInstanceInput = RouterInput['decision']['updateDecisionInstance'];

/**
 * Whether an instance update carried a rubric, i.e. whether this write is the
 * one the server counts as "set the rubric". Mirrors the server's condition in
 * `updateDecisionInstance` (`rubricTemplate !== undefined`), so the two stay in
 * lockstep — the footer always sends the key and leaves the value undefined
 * when the rubric is not dirty.
 */
export const hasRubricChange = (variables: UpdateInstanceInput): boolean =>
  variables.rubricTemplate !== undefined;
