import { cache } from '@op/cache';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { reverseGeocodeLocation } from './reverseGeocode';

// `cache` wraps the actual work. Stub it to just run `fetch()` so we test the
// geocoding logic directly, while capturing the args it was called with so we
// can assert coordinate rounding + options.
vi.mock('@op/cache', () => ({
  cache: vi.fn(
    async ({ fetch }: { fetch: () => Promise<unknown> }) => await fetch(),
  ),
}));

const mockCache = vi.mocked(cache);

const okResult = {
  status: 'OK',
  results: [
    {
      place_id: 'place-123',
      formatted_address: '123 Main St, Columbus, OH, USA',
      geometry: { location: { lat: 39.96123, lng: -82.99123 } },
      address_components: [
        { types: ['locality'], short_name: 'Columbus', long_name: 'Columbus' },
        {
          types: ['country', 'political'],
          short_name: 'US',
          long_name: 'United States',
        },
      ],
    },
  ],
};

function mockFetchResolves(body: unknown, ok = true) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok,
      statusText: 'Error',
      json: async () => body,
    }),
  );
}

describe('reverseGeocodeLocation', () => {
  beforeEach(() => {
    mockCache.mockClear();
    process.env.GOOGLE_MAPS_API_KEY = 'test-key';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('maps an OK result with a country component to a ReverseGeoName', async () => {
    mockFetchResolves(okResult);

    const result = await reverseGeocodeLocation({
      lat: 39.96123,
      lng: -82.99123,
    });

    expect(result).toEqual({
      placeId: 'place-123',
      address: '123 Main St, Columbus, OH, USA',
      lat: 39.96123,
      lng: -82.99123,
      countryCode: 'US',
      countryName: 'United States',
    });
  });

  it('returns null on ZERO_RESULTS (no results array)', async () => {
    mockFetchResolves({ status: 'ZERO_RESULTS', results: [] });

    const result = await reverseGeocodeLocation({ lat: 0, lng: 0 });

    expect(result).toBeNull();
  });

  it('returns null when the response is not ok / status is unexpected', async () => {
    mockFetchResolves({ status: 'REQUEST_DENIED' }, false);

    const result = await reverseGeocodeLocation({ lat: 39.96, lng: -82.99 });

    expect(result).toBeNull();
  });

  it('returns null when fetch() rejects', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('network down')),
    );

    const result = await reverseGeocodeLocation({ lat: 39.96, lng: -82.99 });

    expect(result).toBeNull();
  });

  it('rounds coordinates to 5 decimals and stores nulls in the cache key', async () => {
    mockFetchResolves(okResult);

    await reverseGeocodeLocation({ lat: 39.9612345, lng: -82.9912345 });

    expect(mockCache).toHaveBeenCalledTimes(1);
    const callArg = mockCache.mock.calls[0]![0];
    expect(callArg.params).toEqual([39.96123, -82.99123]);
    expect(callArg.options).toEqual({ storeNulls: true });
  });
});
