import { describe, it } from 'vitest';

import { createGatingCallers, type GatingTestCtx } from './callers';

// Re-exported so decision gating tests can pull the tier assertions from the
// same module as describeDecisionProcedureGating.
export { expectFailsTierGate, expectPassesTierGate } from '.';

type DecisionGatingBody = (ctx: GatingTestCtx) => Promise<void>;

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
  noJwtNonPublic: DecisionGatingBody;
  anonJwtNonPublic: DecisionGatingBody;
  userJwtNonPublic: DecisionGatingBody;
  networkJwtNonPublic: DecisionGatingBody;
};

export const describeDecisionProcedureGating = (
  name: string,
  cells: DecisionGatingCells,
) => {
  describe(`${name}: tier gating`, () => {
    const wrap =
      (body: DecisionGatingBody) =>
      async ({
        task,
        onTestFinished,
      }: {
        task: { id: string };
        onTestFinished: (fn: () => void | Promise<void>) => void;
      }) => {
        await body({
          task,
          onTestFinished,
          callers: createGatingCallers(onTestFinished),
        });
      };

    it('no-JWT caller on non-public instance', wrap(cells.noJwtNonPublic));
    it('anon-JWT caller on non-public instance', wrap(cells.anonJwtNonPublic));
    it('user-JWT caller on non-public instance', wrap(cells.userJwtNonPublic));
    it(
      'network-JWT caller on non-public instance',
      wrap(cells.networkJwtNonPublic),
    );
  });
};
