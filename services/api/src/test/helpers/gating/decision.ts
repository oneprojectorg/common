import { describe } from 'vitest';

import { type GatingCell, itAccessTierGatingCell } from '.';

// Re-exported so decision gating tests can pull the tier assertions from the
// same module as describeDecisionAccessTierGating.
export {
  accessTierGatingCell,
  expectFailsAccessTierGate,
  expectPassesAccessTierGate,
} from '.';

/**
 * Decision-instance endpoints that participate in network gating declare an
 * outcome for the four caller kinds (no-JWT / anon-JWT / user-JWT / network-JWT)
 * against a non-public instance. What each cell asserts depends on the
 * procedure's tier: a `networkAuthenticatedProcedure` endpoint rejects the
 * first three at the tier gate (`AccessTierError`); an `openProcedure` endpoint
 * admits them past the gate and the service denies them (`UnauthorizedError`).
 *
 * Forgetting a key is a compile error.
 */
export type DecisionGatingCells = {
  noJwtNonPublic: GatingCell;
  anonJwtNonPublic: GatingCell;
  userJwtNonPublic: GatingCell;
  networkJwtNonPublic: GatingCell;
};

export const describeDecisionAccessTierGating = (
  name: string,
  cells: DecisionGatingCells,
) => {
  describe.concurrent(`${name}: access-tier gating`, () => {
    itAccessTierGatingCell(cells.noJwtNonPublic);
    itAccessTierGatingCell(cells.anonJwtNonPublic);
    itAccessTierGatingCell(cells.userJwtNonPublic);
    itAccessTierGatingCell(cells.networkJwtNonPublic);
  });
};
