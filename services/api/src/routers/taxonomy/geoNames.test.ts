import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  fetchPlacesFromGoogle,
  normalizeQueryForCacheKey,
} from './geoNames';

const placesOkResponse = {
  places: [
    {
      id: 'place-abc',
      displayName: { text: 'Starbucks' },
      formattedAddress: '123 Main St, Columbus, OH 43215, USA',
      addressComponents: [
        {
          types: ['country', 'political'],
          shortText: 'US',
          longText: 'United States',
        },
      ],
      location: { latitude: 39.96123, longitude: -82.99876 },
    },
  ],
};

function mockFetchResolves(body: unknown, ok = true) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok,
      statusText: 'Internal Server Error',
      json: async () => body,
    }),
  );
}

describe('normalizeQueryForCacheKey', () => {
  it('trims surrounding whitespace and lowercases', () => {
    expect(normalizeQueryForCacheKey('  Main Street  ')).toBe('main street');
    expect(normalizeQueryForCacheKey('MAIN STREET')).toBe('main street');
    expect(normalizeQueryForCacheKey('main street')).toBe('main street');
  });

  it('collapses near-duplicate inputs onto the same key', () => {
    const variants = [
      'Starbucks',
      'starbucks',
      'STARBUCKS',
      '  starbucks ',
      'Starbucks ',
    ];

    const keys = new Set(variants.map(normalizeQueryForCacheKey));

    expect(keys.size).toBe(1);
    expect(keys.has('starbucks')).toBe(true);
  });

  it('preserves internal whitespace and non-ASCII characters', () => {
    expect(normalizeQueryForCacheKey('  Café  Marie ')).toBe('café  marie');
  });
});

describe('fetchPlacesFromGoogle', () => {
  beforeEach(() => {
    process.env.GOOGLE_MAPS_API_KEY = 'test-key';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('maps an OK Places response to GeoName entries', async () => {
    mockFetchResolves(placesOkResponse);

    const result = await fetchPlacesFromGoogle({ q: 'starbucks' });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      placeId: 'place-abc',
      name: 'Starbucks',
      address: '123 Main St, Columbus, OH 43215, USA',
      lat: 39.96123,
      lng: -82.99876,
      countryCode: 'US',
      countryName: 'United States',
    });
  });

  it('returns an empty array when Google has no matching places (genuine empty)', async () => {
    mockFetchResolves({});

    const result = await fetchPlacesFromGoogle({ q: 'asdfqwerzxcv' });

    expect(result).toEqual([]);
  });

  it('throws on a non-OK Google response so the cache wrapper does not store the failure', async () => {
    mockFetchResolves(
      { error_message: 'quota exceeded' },
      /* ok */ false,
    );

    await expect(fetchPlacesFromGoogle({ q: 'main' })).rejects.toThrow(
      /Google Maps API error: quota exceeded/,
    );
  });

  it('propagates a network failure (fetch reject) so the cache wrapper does not store the failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('network down')),
    );

    await expect(fetchPlacesFromGoogle({ q: 'main' })).rejects.toThrow(
      /network down/,
    );
  });

  it('forwards the raw query and locationBias circle to Places', async () => {
    mockFetchResolves(placesOkResponse);

    await fetchPlacesFromGoogle({
      q: 'Main Street',
      center: { lat: 39.96, lng: -82.99 },
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const body = JSON.parse(init.body);
    expect(body.textQuery).toBe('Main Street');
    expect(body.locationBias.circle.center).toEqual({
      latitude: 39.96,
      longitude: -82.99,
    });
    expect(body.locationBias.circle.radius).toBe(50_000);
  });

  it('omits locationBias when no center is supplied', async () => {
    mockFetchResolves(placesOkResponse);

    await fetchPlacesFromGoogle({ q: 'starbucks' });

    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const body = JSON.parse(init.body);
    expect(body.locationBias).toBeUndefined();
  });
});
