import { mergeRouters } from '../../trpcFactory';
import { getGeoNames } from './geoNames';
import { reverseGeocode } from './reverseGeocode';
import { termsRouter } from './taxonomyTerms';

export const taxonomyRouter = mergeRouters(
  getGeoNames,
  reverseGeocode,
  termsRouter,
);
