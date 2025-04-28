import { mergeRouters } from '../../trpcFactory';
import { getGeoNames } from './geoNames';

export const externalRouter = mergeRouters(getGeoNames);
