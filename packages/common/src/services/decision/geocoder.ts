import { forwardGeocode } from './forwardGeocode';
import type { Geocode } from './voterEnrolment';

const parseStubPoint = (raw: string | undefined) => {
  if (!raw || process.env.NODE_ENV === 'production') {
    return null;
  }
  const [lat, lng] = raw.split(',').map((part) => Number(part.trim()));
  return lat !== undefined &&
    lng !== undefined &&
    Number.isFinite(lat) &&
    Number.isFinite(lng)
    ? { lat, lng }
    : null;
};

export const getGeocoder = (): Geocode => {
  const stub = parseStubPoint(process.env.SMS_GEOCODE_STUB);
  return stub
    ? async () => [stub]
    : (address) => forwardGeocode({ query: address });
};
