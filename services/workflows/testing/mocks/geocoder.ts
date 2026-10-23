import type { Geocode } from '@op/common';

const points = new Map<string, ReadonlyArray<{ lat: number; lng: number }>>();

export const memoryGeocoder = {
  set(address: string, found: ReadonlyArray<{ lat: number; lng: number }>) {
    points.set(address.trim().toLowerCase(), found);
  },
  reset() {
    points.clear();
  },
};

export const geocoderMock = () => ({
  getGeocoder: (): Geocode => async (address) =>
    points.get(address.trim().toLowerCase()) ?? [],
});
