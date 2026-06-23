import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  fillCategoryFromBoundary,
  withBoundaryCategoryLabel,
} from './boundaryCategory';
import { resolveBoundary } from './resolveBoundary';
import type { ProposalTemplateSchema } from './types';

vi.mock('./resolveBoundary', () => ({
  resolveBoundary: vi.fn(),
}));

const mockResolveBoundary = vi.mocked(resolveBoundary);

const district = { id: 'b1', name: 'District 7', taxonomyTermId: 't7' };
const located = { location: { lat: 39.96, lng: -82.99 } };

function template(
  category?: 'single' | 'multi',
  withLocation = true,
): ProposalTemplateSchema {
  const properties: ProposalTemplateSchema['properties'] = {};

  if (withLocation) {
    properties.location = { type: 'object', 'x-format': 'location' };
  }
  if (category === 'single') {
    properties.category = { type: ['string', 'null'], 'x-format': 'dropdown' };
  } else if (category === 'multi') {
    properties.category = { type: 'array', 'x-format': 'dropdown' };
  }

  return { type: 'object', properties };
}

describe('fillCategoryFromBoundary', () => {
  beforeEach(() => mockResolveBoundary.mockReset());

  const scope = { profileId: 'profile-1' };

  it('fills a single-select category with the district label', async () => {
    mockResolveBoundary.mockResolvedValue(district);

    const result = await fillCategoryFromBoundary(
      template('single'),
      { ...located },
      scope,
    );

    expect(result.category).toBe('District 7');
  });

  it('adds the district to a multi-select category, deduplicated', async () => {
    mockResolveBoundary.mockResolvedValue(district);

    const added = await fillCategoryFromBoundary(
      template('multi'),
      { ...located, category: ['Parks'] },
      scope,
    );
    expect(added.category).toEqual(['Parks', 'District 7']);

    const deduped = await fillCategoryFromBoundary(
      template('multi'),
      { ...located, category: ['District 7'] },
      scope,
    );
    expect(deduped.category).toEqual(['District 7']);
  });

  it('is a no-op (no boundary lookup) when the template collects no location', async () => {
    const data = { ...located };

    const result = await fillCategoryFromBoundary(
      template('single', false),
      data,
      scope,
    );

    expect(result).toBe(data);
    expect(mockResolveBoundary).not.toHaveBeenCalled();
  });

  it('is a no-op when no boundary contains the pin', async () => {
    mockResolveBoundary.mockResolvedValue(null);
    const data = { ...located };

    const result = await fillCategoryFromBoundary(
      template('single'),
      data,
      scope,
    );

    expect(result).toBe(data);
  });

  it('scopes the lookup to the given decision profile', async () => {
    mockResolveBoundary.mockResolvedValue(district);

    await fillCategoryFromBoundary(template('single'), located, scope);

    expect(mockResolveBoundary).toHaveBeenCalledWith({
      lat: located.location.lat,
      lng: located.location.lng,
      profileId: scope.profileId,
    });
  });
});

describe('withBoundaryCategoryLabel', () => {
  const scope = { profileId: 'profile-1' };

  beforeEach(() => mockResolveBoundary.mockReset());

  it('appends the district label, deduplicated', async () => {
    mockResolveBoundary.mockResolvedValue(district);

    expect(await withBoundaryCategoryLabel(['Parks'], located, scope)).toEqual([
      'Parks',
      'District 7',
    ]);
    expect(
      await withBoundaryCategoryLabel(['District 7'], located, scope),
    ).toEqual(['District 7']);
  });

  it('returns the labels unchanged when no boundary matches', async () => {
    mockResolveBoundary.mockResolvedValue(null);
    const labels = ['Parks'];

    expect(await withBoundaryCategoryLabel(labels, located, scope)).toBe(
      labels,
    );
  });
});
