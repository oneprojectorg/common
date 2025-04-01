import { db } from '@op/db/client';
import { tables } from '@op/db/tables';

import type { MiddlewareBuilderBase, TContextWithDB } from '../types';

const withDB: MiddlewareBuilderBase<TContextWithDB> = async ({ ctx, next }) => {
  const result = await next({
    ctx: {
      ...ctx,
      database: {
        db,
        tables,
      },
    },
  });

  return result;
};

export default withDB;
