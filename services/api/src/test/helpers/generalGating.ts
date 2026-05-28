import { describe, it } from 'vitest';

import { createGatingCallers, type GatingTestCtx } from './gatingCallers';

type GeneralGatingBody = (ctx: GatingTestCtx) => Promise<void>;

/**
 * Auth-gating matrix for endpoints that have no decision-instance dimension.
 * Three cells: one per caller kind. Forgetting a key is a compile error.
 */
export type GeneralGatingCells = {
  noJwt: GeneralGatingBody;
  anonJwt: GeneralGatingBody;
  commonJwt: GeneralGatingBody;
};

export const describeGeneralGating = (
  name: string,
  cells: GeneralGatingCells,
) => {
  describe(`${name}: auth gating`, () => {
    const wrap =
      (body: GeneralGatingBody) =>
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

    it('no-JWT caller', wrap(cells.noJwt));
    it('anon-JWT caller', wrap(cells.anonJwt));
    it('common-JWT caller', wrap(cells.commonJwt));
  });
};
