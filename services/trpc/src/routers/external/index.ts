import { mergeRouters } from '../../trpcFactory';

import { getGeoNames } from './fetchProxy';

export const externalRouter = mergeRouters(getGeoNames);
