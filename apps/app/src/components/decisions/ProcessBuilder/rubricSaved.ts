import type { RouterInput } from '@op/api/client';

type UpdateInstanceInput = RouterInput['decision']['updateDecisionInstance'];

/** Must stay in lockstep with `updateDecisionInstance`'s own rubric condition. */
export const hasRubricChange = (variables: UpdateInstanceInput): boolean =>
  variables.rubricTemplate !== undefined;
