import { describe, it } from 'vitest';

import { createGatingCallers, type GatingTestCtx } from './callers';

type DecisionGatingBody = (ctx: GatingTestCtx) => Promise<void>;

/**
 * Decision-instance endpoints that participate in network gating declare an
 * outcome for the three caller kinds (no-JWT / anon-JWT / common-JWT)
 * against a non-public instance. Public-mode cells will be added when the
 * public-instance toggle mechanism lands; until then the matrix only
 * exercises the closed-network behavior that is enforced today.
 *
 * Forgetting a key is a compile error.
 */
export type DecisionGatingCells = {
  noJwtNonPublic: DecisionGatingBody;
  anonJwtNonPublic: DecisionGatingBody;
  commonJwtNonPublic: DecisionGatingBody;
};

export const describeDecisionGating = (
  name: string,
  cells: DecisionGatingCells,
) => {
  describe(`${name}: network gating`, () => {
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
    it(
      'common-JWT caller on non-public instance',
      wrap(cells.commonJwtNonPublic),
    );
  });
};
