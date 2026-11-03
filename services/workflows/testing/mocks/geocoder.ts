import type { Geocode } from '@op/common';

const points = new Map<string, ReadonlyArray<{ lat: number; lng: number }>>();
const failures = new Set<string>();

export const memoryGeocoder = {
  set(address: string, found: ReadonlyArray<{ lat: number; lng: number }>) {
    points.set(address.trim().toLowerCase(), found);
  },
  fail(address: string) {
    failures.add(address.trim().toLowerCase());
  },
  reset() {
    points.clear();
    failures.clear();
  },
};

export const geocoderMock = () => ({
  getGeocoder: (): Geocode => async (address) => {
    const key = address.trim().toLowerCase();
    if (failures.has(key)) {
      throw new Error(`geocoder down for ${address}`);
    }
    return points.get(key) ?? [];
  },
});
