import { describe, it } from 'vitest';

import { createGatingCallers, type GatingTestCtx } from './gatingCallers';

type DecisionGatingBody = (ctx: GatingTestCtx) => Promise<void>;

/**
 * Every decision-instance endpoint that participates in public-mode gating
 * must declare an outcome for all six cells: three caller kinds
 * (no-JWT / anon-JWT / common-JWT) crossed with two instance visibilities
 * (public / non-public).
 *
 * Forgetting a key is a compile error. Each cell owns its own setup and
 * assertion — the helper only provides caller factories and the labelled
 * `it()` blocks.
 */
export type DecisionGatingCells = {
  noJwtPublic: DecisionGatingBody;
  anonJwtPublic: DecisionGatingBody;
  commonJwtPublic: DecisionGatingBody;
  noJwtNonPublic: DecisionGatingBody;
  anonJwtNonPublic: DecisionGatingBody;
  commonJwtNonPublic: DecisionGatingBody;
};

export const describeDecisionGating = (
  name: string,
  cells: DecisionGatingCells,
) => {
  describe(`${name}: public-mode gating`, () => {
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

    it('no-JWT caller on public instance', wrap(cells.noJwtPublic));
    it('anon-JWT caller on public instance', wrap(cells.anonJwtPublic));
    it('common-JWT caller on public instance', wrap(cells.commonJwtPublic));
    it('no-JWT caller on non-public instance', wrap(cells.noJwtNonPublic));
    it('anon-JWT caller on non-public instance', wrap(cells.anonJwtNonPublic));
    it(
      'common-JWT caller on non-public instance',
      wrap(cells.commonJwtNonPublic),
    );
  });
};
