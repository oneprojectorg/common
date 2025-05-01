import { mergeRouters } from '../../trpcFactory';
import { getGeoNames } from './geoNames';
import { termsRouter } from './taxonomyTerms';

export const externalRouter = mergeRouters(getGeoNames, termsRouter);
