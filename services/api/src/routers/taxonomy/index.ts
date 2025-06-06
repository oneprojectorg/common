import { mergeRouters } from '../../trpcFactory';
import { getGeoNames } from './geoNames';
import { termsRouter } from './taxonomyTerms';

export const taxonomyRouter = mergeRouters(getGeoNames, termsRouter);
