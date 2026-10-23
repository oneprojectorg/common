import { forwardGeocode } from './forwardGeocode';
import type { Geocode } from './voterEnrolment';

export const getGeocoder = (): Geocode => (address) =>
  forwardGeocode({ query: address });
