import { runWithRequestCache } from '@op/common/src/services/access';

import type { MiddlewareBuilderBase } from '../types';

const withRequestCache: MiddlewareBuilderBase = ({ ctx, next }) =>
  runWithRequestCache(() => next({ ctx }));

export default withRequestCache;
