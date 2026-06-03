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
 * against a non-public instance. Decision endpoints are `commonAuthedProcedure`,
 * so the first three are rejected by the tier gate (`AccessTierError`) and
 * network-JWT is admitted. Public-mode cells will be added when the
 * public-instance toggle
 * mechanism lands; until then the matrix only exercises the closed-network
 * behavior that is enforced today.
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
